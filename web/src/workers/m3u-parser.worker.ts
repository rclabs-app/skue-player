/**
 * M3U Parser Worker — Memory-Safe Edition
 *
 * Problem on Smart TVs (≤256 MB heap):
 *   The old approach built 3 huge arrays (live, movies, episodes) from 
 *   the full parsed result, then passed them all into SQLite, then called 
 *   db.export() to get a Uint8Array copy of the entire DB (~50-80 MB), 
 *   then postMessage'd it to the main thread — tripling peak memory usage.
 *   On a playlist with 243k episodes this reliably OOMs the TV WebView.
 *
 * Fix:
 *   1. Parse line-by-line and insert directly into SQLite in small batches
 *      (CHUNK_SIZE rows per COMMIT) — never holding the full array in memory.
 *   2. Persist the DB to OPFS/IDB from within the worker — no export() blob
 *      transferred to main thread.
 *   3. Send only lightweight metadata (counts) back to main thread.
 */

import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { SCHEMA } from '../lib/sqlite'
import { contentId } from '../lib/contentIdentity'
import { restorePlaylistUserData } from '../lib/playlistUserData'
import type { PlaylistItem } from '../types/m3u'

// How many rows to INSERT per COMMIT — keeps peak memory low
const CHUNK_SIZE = 2000

// ─── Persistence helpers (duplicated from sqlite-persistence to avoid import) ─
const OPFS_FILENAME = 'skue.db'
const IDB_DB_NAME  = 'skue-sqlite-persistence'
const IDB_STORE    = 'database'
const IDB_KEY      = 'main'

async function canUseOPFS(): Promise<boolean> {
  try {
    if (typeof self.navigator === 'undefined') return false
    // @ts-ignore
    if (!self.navigator.storage?.getDirectory) return false
    // @ts-ignore
    await self.navigator.storage.getDirectory()
    return true
  } catch { return false }
}

async function persistDb(data: Uint8Array): Promise<void> {
  if (await canUseOPFS()) {
    try {
      // @ts-ignore
      const root = await self.navigator.storage.getDirectory()
      // @ts-ignore
      const fh = await root.getFileHandle(OPFS_FILENAME, { create: true })
      // @ts-ignore
      const writable = await fh.createWritable()
      await writable.write(data)
      await writable.close()
      return
    } catch (e) {
      console.warn('Worker OPFS persist failed, falling back to IDB:', e)
    }
  }
  // IDB fallback
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(data, IDB_KEY)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    }
    req.onerror = () => reject(req.error)
  })
}

// ─── Lightweight streaming M3U parser ────────────────────────────────────────

function determineType(url: string, group: string, name: string, tvgId: string | null): 'live' | 'movie' | 'series' {
  const lu = url.toLowerCase()
  if (lu.includes('/movie/'))  return 'movie'
  if (lu.includes('/series/')) return 'series'
  if (lu.includes('/live/'))   return 'live'
  if (lu.endsWith('.ts') || lu.endsWith('.m3u8')) return 'live'
  if (tvgId && tvgId.trim() !== '') return 'live'

  const lg = group.toLowerCase()
  const ln = name.toLowerCase()

  const grpLivePri  = ['24h','24 h','24 horas','canais','ao vivo','pay-per-view','premiere','esportes','sports','futebol','campeonato','copa','combate','ufc','conmebol','abertos']
  if (grpLivePri.some(k => lg.includes(k))) return 'live'
  const grpSeries   = ['serie','série','animes','dorama','novela']
  if (grpSeries.some(k => lg.includes(k))) return 'series'
  const grpMovies   = ['movie','filme','vod','cinema','lançamento']
  if (grpMovies.some(k => lg.includes(k))) return 'movie'
  const grpLiveSec  = ['noticias','notícias','religiosos','globo','sbt','record','band','telecine','hbo']
  if (grpLiveSec.some(k => lg.includes(k))) return 'live'

  const nameLive = ['ao vivo','pay-per-view','premiere','brasileirao','brasileirão','combate','conmebol','24h']
  if (nameLive.some(k => ln.includes(k))) return 'live'
  if (/S\d{1,2}\s*E\d{1,3}/i.test(name) || /\d{1,2}x\d{1,3}/i.test(name) || /Ep\.?\s*\d+/i.test(name)) return 'series'
  const nameSeries = ['season','episodio','episode','serie','série']
  if (nameSeries.some(k => ln.includes(k))) return 'series'
  const nameMovie  = ['movie','filme']
  if (nameMovie.some(k => ln.includes(k))) return 'movie'

  return 'live'
}

function buildSerieKey(name: string): string {
  return name
    .replace(/\s*[-–]?\s*S\d{1,3}\s*E\d{1,3}.*$/i, '')
    .replace(/\s*\d{1,3}x\d{1,3}.*$/i, '')
    .replace(/\s*-\s*Ep[.:]?\s*\d+.*$/i, '')
    .replace(/\s*\(\d{4}\)\s*$/i, '')
    .replace(/\s+\d{4}$/i, '')
    .trim().toLowerCase()
}

function cleanDisplayName(name: string): string {
  return name
    .replace(/\s*[-–]?\s*S\d{1,3}\s*E\d{1,3}.*$/i, '')
    .replace(/\s*\d{1,3}x\d{1,3}.*$/i, '')
    .replace(/\s*-\s*Ep[.:]?\s*\d+.*$/i, '')
    .replace(/\s*\(\d{4}\)\s*$/i, '')
    .replace(/\s+\d{4}$/i, '')
    .trim()
}

// ─── Main ─────────────────────────────────────────────────────────────────────

let db: any;
let stmtItem: any;
let stmtSeries: any;
const seriesMap = new Map<string, { id: string; displayName: string; group: string; logo: string | null; count: number }>()

let retainedEpisodes: PlaylistItem[] = []
let itemIdx = 0
let chunkCount = 0
let counts = { live: 0, movie: 0, series: 0 }

let currentName = ''
let currentGroup = 'Uncategorized'
let currentLogo: string | null = null
let currentTvgId: string | null = null
let hasCurrentItem = false

let remainder = ''
const decoder = new TextDecoder('utf-8')

const commitChunk = () => {
  db.run('COMMIT')
  db.run('BEGIN TRANSACTION')
  chunkCount = 0
}

let currentXtreamSeriesKey: string | null = null

function processLines(text: string) {
  const content = remainder + text
  let pos = 0
  const len = content.length

  while (pos < len) {
    let end = content.indexOf('\n', pos)
    if (end === -1) {
      // Incomplete line at the end of the chunk
      remainder = content.slice(pos)
      return
    }

    const lineEnd = end > pos && content[end - 1] === '\r' ? end - 1 : end
    const line = content.slice(pos, lineEnd).trim()
    pos = end + 1

    if (!line) continue

    if (line.startsWith('#EXTINF:')) {
      currentXtreamSeriesKey = null
      currentName = 'Unknown'
      currentGroup = 'Uncategorized'
      currentLogo = null
      currentTvgId = null

      const attrRx = /([a-zA-Z0-9-]+)="([^"]*)"/g
      let match: RegExpExecArray | null
      while ((match = attrRx.exec(line)) !== null) {
        switch (match[1]) {
          case 'group-title': currentGroup = match[2]; break
          case 'tvg-logo':    currentLogo  = match[2] || null; break
          case 'tvg-id':      currentTvgId = match[2] || null; break
          case 'skue-series-key': currentXtreamSeriesKey = /^xc:vod2-[a-z0-9]+-[a-z0-9]+:\d+$/.test(match[2]) ? match[2] : null; break
        }
      }
      const ci = line.lastIndexOf(',')
      if (ci !== -1) currentName = line.substring(ci + 1).trim()
      hasCurrentItem = true

    } else if (line[0] === '#') {
      continue
    } else if (hasCurrentItem) {
      const url  = line
      const type = determineType(url, currentGroup, currentName, currentTvgId)
      const id   = contentId(url, currentName)
      itemIdx++

      let serieKey: string | null = null
      if (type === 'series') {
        serieKey = currentXtreamSeriesKey || buildSerieKey(currentName)
        const existing = seriesMap.get(serieKey)
        if (!existing) {
          seriesMap.set(serieKey, {
            id,
            displayName: cleanDisplayName(currentName),
            group: currentGroup,
            logo: currentLogo,
            count: currentXtreamSeriesKey ? 0 : 1,
          })
        } else {
          existing.count++
          if (!existing.logo && currentLogo) existing.logo = currentLogo
        }
        counts.series++
      } else if (type === 'movie') {
        counts.movie++
      } else {
        counts.live++
      }

      stmtItem.run([id, currentName, url, currentGroup || 'Outros', currentLogo, currentTvgId, type, serieKey])
      chunkCount++

      if (chunkCount >= CHUNK_SIZE) {
        commitChunk()
        if (itemIdx % 20000 === 0) {
          self.postMessage({
            type: 'progress',
            message: `Processando... ${itemIdx.toLocaleString()} itens (${counts.live} live, ${counts.movie} filmes, ${counts.series} episódios)`
          })
        }
      }
      hasCurrentItem = false
    }
  }
  remainder = ''
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data

  try {
    if (msg.type === 'init') {
      self.postMessage({ type: 'progress', message: 'Iniciando banco de dados...' })
      const SQL = await initSqlJs({ locateFile: () => wasmUrl })
      retainedEpisodes = msg.retainedEpisodes || []
      db  = new SQL.Database()
      db.run(SCHEMA)
      restorePlaylistUserData(db, msg.userData || {})
      db.run('DELETE FROM playlist')
      db.run('DELETE FROM series_index')

      stmtItem = db.prepare('INSERT OR REPLACE INTO playlist (id, name, url, group_title, logo, tvg_id, type, serie_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      stmtSeries = db.prepare('INSERT OR REPLACE INTO series_index (id, display_name, group_title, logo, serie_key, episode_count) VALUES (?, ?, ?, ?, ?, ?)')
      
      db.run('BEGIN TRANSACTION')
      self.postMessage({ type: 'ack_init' })

    } else if (msg.type === 'chunk') {
      const text = decoder.decode(msg.data, { stream: true })
      processLines(text)
      self.postMessage({ type: 'ack_chunk' })

    } else if (msg.type === 'end') {
      // Process any remaining text in the stream buffer
      const finalStr = decoder.decode()
      if (finalStr || remainder) {
        processLines(finalStr + '\n')
      }

      for (const item of retainedEpisodes) {
        const series = item.serieKey ? seriesMap.get(item.serieKey) : null
        if (!series) continue
        stmtItem.run([item.id,item.name,item.url,item.group,item.logo || null,item.tvgId || null,'series',item.serieKey])
        series.count++
      }
      retainedEpisodes = []
      db.run('COMMIT')
      stmtItem.free()

      self.postMessage({ type: 'progress', message: `Salvando índice de ${seriesMap.size.toLocaleString()} séries...` })
      db.run('BEGIN TRANSACTION')
      for (const [key, s] of seriesMap) {
        stmtSeries.run([s.id, s.displayName, s.group || 'Outros', s.logo, key, s.count])
      }
      db.run('COMMIT')
      stmtSeries.free()

      self.postMessage({ type: 'progress', message: 'Gravando banco de dados...' })
      const dbData = db.export()
      db.close()

      await persistDb(dbData)

      // @ts-ignore
      if (dbData.fill) dbData.fill(0)

      self.postMessage({
        type: 'done',
        counts: {
          live: counts.live,
          movie: counts.movie,
          series: counts.series,
          seriesIndex: seriesMap.size
        }
      })
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
