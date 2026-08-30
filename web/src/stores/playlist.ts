import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import type { PlaylistItem, SeriesEntry } from '../types/m3u'
import { db } from '../lib/database'
import M3uWorker from '../workers/m3u-parser.worker?worker'
import { getDeviceMac, getDeviceName } from '../utils/device'
import { getApiUrl } from '../utils/api'
import { EPGService } from '../services/epg.service'
import { cleanName } from '../utils/text'


export const usePlaylistStore = defineStore('playlist', () => {
  const isLoaded = ref(false)
  const isProcessing = ref(false)
  const processingProgress = ref('')
  const error = ref<string | null>(null)

  // Live + Movies: no longer fully loaded in RAM.
  // They are fetched on demand from the database.

  /**
   * SERIES STRATEGY — series-first model:
   *
   * Instead of keeping 200k episode PlaylistItems in RAM, we only hold the
   * deduplicated ~5k SeriesEntry objects (one per unique show title).
   * Episodes stay in IndexedDB and are fetched on-demand per series via
   * `getSeriesEpisodes(serieKey)`.
   *
   * RAM reduction: 200k × 300B → 5k × 200B ≈ -97% memory for series.
   */
  const seriesIndex = shallowRef<SeriesEntry[]>([])


  const epgUrl = ref<string | null>(null)
  const epgSyncStatus = ref('')

  // ─── Derived ───────────────────────────────────────────────────────────────
  /**
   * The grid data for SeriesView. Uses the lightweight index — NOT 200k episodes.
   */
  const uniqueSeries = computed<SeriesEntry[]>(() => seriesIndex.value)

  /**
   * Legacy compat: series IDs from the index.
   */
  const seriesIdSet = shallowRef<Set<string>>(new Set())

  function isSeriesId(id: string): boolean {
    return seriesIdSet.value.has(id)
  }

  /**
   * On-demand episode fetch — called from DetailsView when user opens a series.
   * Queries IDB by serieKey index — does NOT scan 200k items.
   */
  async function getSeriesEpisodes(serieKey: string): Promise<PlaylistItem[]> {
    return db.getEpisodesBySerieKey(serieKey)
  }

  // ─── Device State ──────────────────────────────────────────────────────────
  interface DevicePlaylist {
    id: number
    name: string
    is_active: boolean
    username?: string
    password?: string
    url?: string
  }
  
  const deviceMac = ref('')
  const devicePlaylists = shallowRef<DevicePlaylist[]>([])

  async function initialize() {
    try {
      deviceMac.value = await getDeviceMac()
      const loaded = await db.getConfig('playlist_loaded')
      if (loaded) await loadFromDb()
      isLoaded.value = !!loaded
    } catch (e) {
      error.value = 'Failed to initialize database'
      console.error(e)
    }
  }

  async function syncHandshake(): Promise<{ device_key: string; key_expires_at: string; playlists_count: number }> {
    const response = await fetch(getApiUrl('/api/v1/devices/handshake'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac: deviceMac.value, name: getDeviceName() })
    })
    if (!response.ok) throw new Error('Handshake failed')
    const data = await response.json()
    if (data.device_token) await db.saveConfig('device_token', data.device_token)
    return {
      device_key: data.device_key,
      key_expires_at: data.key_expires_at,
      playlists_count: data.playlists_count
    }
  }

  async function fetchDeviceConfig(): Promise<any[]> {
    try {
      const token = await db.getConfig('device_token')
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const response = await fetch(getApiUrl(`/api/v1/devices/${deviceMac.value}/config`), { headers })
      if (!response.ok) throw new Error('Failed to fetch remote config')
      const data = await response.json()
      devicePlaylists.value = data.playlists || []
      return devicePlaylists.value
    } catch (e) {
      console.error('Fetch config error:', e)
      return []
    }
  }

  // ─── Load from DB (startup path) ─────────────────────────────────────────
  async function loadFromDb() {
    isProcessing.value = true
    processingProgress.value = 'Loading from local database...'

    try {
      // Live and movies are now fetched on demand.

      // Load the SERIES INDEX (deduplicated, ~5k entries) — NOT the 200k episodes
      let idx = await db.getSeriesIndex()
      if (!idx || idx.length === 0) {
        const rawSeries = await db.getPlaylistItems('series')
        if (rawSeries && rawSeries.length > 0) {
          const map = new Map<string, SeriesEntry>()
          for (const item of rawSeries) {
            const key = item.serieKey || cleanName(item.name).toLowerCase()
            if (!map.has(key)) {
              map.set(key, {
                id: item.id,
                displayName: cleanName(item.name),
                group: item.group,
                logo: item.logo,
                serieKey: key,
                episodeCount: 1
              })
            } else {
              const existing = map.get(key)!
              existing.episodeCount++
            }
          }
          idx = Array.from(map.values())
          await db.saveSeriesIndex(idx)
        }
      }
      seriesIndex.value = idx

      // Build a fast lookup set of IDs for isSeriesId()
      const ids = new Set<string>()
      for (const s of idx) ids.add(s.id)
      seriesIdSet.value = ids

      epgUrl.value = await db.getConfig('epg_url')
      isLoaded.value = true
    } catch (e) {
      error.value = 'Failed to load playlist from database'
      console.error(e)
    } finally {
      isProcessing.value = false
    }
  }

  // ─── Load from URL (download + parse + save) ──────────────────────────────
  async function loadPlaylistFromUrl(url: string) {
    isProcessing.value = true
    error.value = null
    processingProgress.value = 'Downloading playlist...'

    try {
      let responseToStream: Response | null = null
      
      // 1. Try direct fetch first
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 60000)
        
        const directResp = await fetch(url, { signal: controller.signal })
        clearTimeout(timeoutId)
        
        if (directResp.ok) {
          responseToStream = directResp
        }
      } catch (e: any) {
        console.warn('Direct fetch failed:', e.message)
        if (e.name === 'AbortError') {
          throw new Error('Tempo limite excedido ao baixar a lista. A lista é muito grande ou a internet está lenta.')
        }
      }

      // 2. Proxy fetch fallback
      if (!responseToStream) {
        const token = await db.getConfig('device_token')
        const headers: Record<string, string> = { 
          'Content-Type': 'application/json',
          'Accept': 'application/json' 
        }
        if (token) headers['Authorization'] = `Bearer ${token}`

        const proxyController = new AbortController()
        const proxyTimeoutId = setTimeout(() => proxyController.abort(), 60000)

        const response = await fetch(getApiUrl('/api/v1/proxy'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ url }),
          signal: proxyController.signal
        }).catch(e => {
          if (e.name === 'AbortError') {
            throw new Error('Tempo limite excedido ao usar o servidor proxy.')
          }
          throw e
        })
        clearTimeout(proxyTimeoutId)

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('Muitas requisições enviadas. Por favor, aguarde 1 minuto e tente novamente.')
          }
          let errText = `Falha no download da lista (${response.status} ${response.statusText || 'Erro no servidor'})`
          try {
            const data = await response.json()
            if (data.error) errText = data.error
          } catch {}
          throw new Error(errText)
        }
        responseToStream = response
      }

      await streamToWorker(responseToStream, url)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erro desconhecido ao carregar lista'
      isProcessing.value = false
      throw e
    }
  }

  // ─── Stream content to Worker ───────────────────────────────────────────────
  async function streamToWorker(response: Response, sourceInfo: string) {
    isProcessing.value = true
    error.value = null
    processingProgress.value = 'Iniciando processamento...'

    if (!response.body) {
      throw new Error('O servidor não retornou dados (Empty Body)')
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const worker = new M3uWorker()
        const reader = response.body!.getReader()

        let nextChunkResolver: (() => void) | null = null

        worker.onmessage = async (e) => {
          const msg = e.data

          if (msg.type === 'progress') {
            processingProgress.value = msg.message
            return
          }

          if (msg.type === 'error') {
            reject(new Error(msg.error))
            worker.terminate()
            return
          }

          if (msg.type === 'ack_init') {
            // Worker is ready, start pumping chunks
            pumpChunks()
          }

          if (msg.type === 'ack_chunk') {
            if (nextChunkResolver) {
              nextChunkResolver()
            }
          }

          if (msg.type === 'done') {
            const { epgUrl: parsedEpgUrl } = msg
            try {
              worker.terminate()
              processingProgress.value = 'Carregando banco de dados...'
              await db.reloadFromStorage()
              await db.saveConfig('playlist_loaded', true)
              await db.saveConfig('playlist_url', sourceInfo)
              await db.saveConfig('epg_url', parsedEpgUrl ?? null)
              await loadFromDb()
              if (parsedEpgUrl) {
                syncEpg(parsedEpgUrl).catch(err => console.error('Auto-sync EPG error:', err))
              }
              resolve()
            } catch (err) {
              reject(err)
            }
          }
        }

        worker.onerror = (e) => {
          reject(new Error(`Worker error: ${e.message}`))
          worker.terminate()
        }

        async function pumpChunks() {
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                worker.postMessage({ type: 'end' })
                break
              }
              
              // Wait for the worker to acknowledge the previous chunk before sending the next one
              // to prevent the postMessage queue from blowing up memory.
              await new Promise<void>((res) => {
                nextChunkResolver = res
                worker.postMessage({ type: 'chunk', data: value }, [value.buffer])
              })
            }
          } catch (err) {
            reject(err)
            worker.terminate()
          }
        }

        // 1. Init worker
        worker.postMessage({ type: 'init' })
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      isProcessing.value = false
      throw e
    }
  }

  async function clearPlaylist() {
    await db.clearPlaylist()
    await db.saveConfig('playlist_loaded', false)
    await db.saveConfig('playlist_url', null)
    await db.saveConfig('epg_url', null)
    await db.clearEpg()

    seriesIndex.value = []
    seriesIdSet.value = new Set()
    epgUrl.value = null
    epgSyncStatus.value = ''
    isLoaded.value = false
  }

  async function syncEpg(url: string) {
    epgSyncStatus.value = 'Iniciando sincronização...'
    try {
      await EPGService.syncEPG(url, (status) => { epgSyncStatus.value = status })
    } catch (e: any) {
      epgSyncStatus.value = `Erro: ${e.message}`
    }
  }

  async function syncCurrentEpg() {
    const url = await db.getConfig<string>('epg_url')
    if (url) await syncEpg(url)
    else epgSyncStatus.value = 'Nenhuma URL de EPG configurada'
  }

  return {
    isLoaded,
    isProcessing,
    processingProgress,
    error,
    seriesIndex,
    series: uniqueSeries,
    uniqueSeries,  // now returns SeriesEntry[] from the deduplicated index
    epgUrl,
    epgSyncStatus,
    deviceMac,
    devicePlaylists,
    getSeriesEpisodes,
    isSeriesId,
    initialize,
    syncHandshake,
    fetchDeviceConfig,
    loadPlaylistFromUrl,
    streamToWorker,
    clearPlaylist,
    syncEpg,
    syncCurrentEpg
  }
})
