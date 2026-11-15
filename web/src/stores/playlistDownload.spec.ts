import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlaylistStore } from './playlist'

const state = vi.hoisted(() => ({ native: false, config: new Map<string, unknown>() }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => state.native } }))
vi.mock('../utils/device', () => ({ getDeviceMac: async () => 'SK:AA:BB:CC:DD:EE', getDeviceName: () => 'Synthetic' }))
vi.mock('../workers/m3u-parser.worker?worker', () => ({ default: class {} }))
vi.mock('../lib/database', () => ({ db: {
  getConfig: vi.fn(async (key: string) => state.config.get(key)),
  saveConfig: vi.fn(async (key: string, value: unknown) => state.config.set(key, value)),
  getEpisodesBySerieKey: vi.fn(async () => []),
  savePlaylistItems: vi.fn(async () => {}),
  saveSeriesIndex: vi.fn(async () => {}),
} }))

beforeEach(() => {
  setActivePinia(createPinia())
  state.native = false
  state.config.clear()
  state.config.set('device_token', 'synthetic-token')
  vi.stubGlobal('window', { location: { protocol: 'https:' } })
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.invalid')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('playlist download restrictions', () => {
  it('restores movie configuration and sends only a numeric ID/format to the ticket route', async () => {
    const source = { type: 'xtream' as const, url: 'http://source.example.invalid', username: 'synthetic', password: 'source-secret' }
    state.config.set('xtream_source', source)
    const store = usePlaylistStore()
    store.deviceMac = 'SK:AA:BB:CC:DD:EE'
    const gateway = 'https://media.example.invalid/v1/media.mp4?ticket=' + 'a'.repeat(40)
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ playlists: [{ ...source, id: 3, name: 'Synthetic', is_active: true, is_main: true }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: gateway })))
    vi.stubGlobal('fetch', fetcher)
    expect(await store.resolveMoviePlayback('http://source.example.invalid/movie/synthetic/source-secret/7.mp4', new AbortController().signal)).toBe(gateway)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[1]![0]).toContain('/playlists/3/movie-ticket')
    expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toEqual({ stream_id: '7', extension: 'mp4' })
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain('source-secret')
  })

  it('does not route native APK movies or an unrelated URL through the gateway', async () => {
    const source = { type: 'xtream' as const, url: 'http://source.example.invalid', username: 'synthetic', password: 'source-secret' }
    state.config.set('xtream_source', source)
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    const store = usePlaylistStore(), signal = new AbortController().signal
    expect(await store.resolveMoviePlayback('http://elsewhere.invalid/movie/7.mp4', signal)).toBeNull()
    state.native = true
    expect(await store.resolveMoviePlayback('http://source.example.invalid/movie/synthetic/source-secret/7.mp4', signal)).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('queries HTTPS episodes through the authenticated playlist route without sending source credentials', async () => {
    const source = { type: 'xtream' as const, url: 'https://source.example.invalid', username: 'synthetic', password: 'source-secret' }
    const { XtreamClient } = await import('../lib/xtream')
    const key = new XtreamClient(source).seriesPrefix + '7'
    state.config.set('xtream_source', source)
    const store = usePlaylistStore()
    store.deviceMac = 'SK:AA:BB:CC:DD:EE'
    store.devicePlaylists = [{ ...source, id: 3, name: 'Synthetic', is_active: true, is_main: true }]
    store.seriesIndex = [{ id: 'synthetic', serieKey: key, displayName: 'Synthetic', group: 'Series', episodeCount: 0 }]
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ episodes: { '1': [{ id: 8, episode_num: 1 }] } })))
    vi.stubGlobal('fetch', fetcher)
    expect(await store.getSeriesEpisodes(key)).toHaveLength(1)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toContain('/playlists/3/xtream/series/7')
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain('source-secret')
  })

  it('preserves direct HTTP episode queries for a native HTTP source', async () => {
    state.native = true
    const source = { type: 'xtream' as const, url: 'http://source.example.invalid', username: 'synthetic', password: 'source-secret' }
    const { XtreamClient } = await import('../lib/xtream')
    const key = new XtreamClient(source).seriesPrefix + '7'
    state.config.set('xtream_source', source)
    const store = usePlaylistStore()
    store.devicePlaylists = [{ ...source, id: 3, name: 'Synthetic', is_active: true, is_main: true }]
    store.seriesIndex = [{ id: 'synthetic', serieKey: key, displayName: 'Synthetic', group: 'Series', episodeCount: 0 }]
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ episodes: { '1': [{ id: 8, episode_num: 1 }] } })))
    vi.stubGlobal('fetch', fetcher)
    expect(await store.getSeriesEpisodes(key)).toHaveLength(1)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toContain('http://source.example.invalid/player_api.php?')
  })

  it('restores the authenticated playlist binding after reopening a cached catalog', async () => {
    const source = { type: 'xtream' as const, url: 'https://source.example.invalid', username: 'synthetic', password: 'source-secret' }
    const { XtreamClient } = await import('../lib/xtream')
    const key = new XtreamClient(source).seriesPrefix + '7'
    state.config.set('xtream_source', source)
    state.config.set('playlist_loaded', true)
    const store = usePlaylistStore()
    store.deviceMac = 'SK:AA:BB:CC:DD:EE'
    store.seriesIndex = [{ id: 'synthetic', serieKey: key, displayName: 'Synthetic', group: 'Series', episodeCount: 0 }]
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ playlists: [{ ...source, id: 3, name: 'Synthetic', is_active: true, is_main: true }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ episodes: { '1': [{ id: 8, episode_num: 1 }] } })))
    vi.stubGlobal('fetch', fetcher)
    expect(await store.getSeriesEpisodes(key)).toHaveLength(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[0][0]).toContain('/config')
    expect(fetcher.mock.calls[1][0]).toContain('/playlists/3/xtream/series/7')
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain('source-secret')
    expect(state.config.get('playlist_loaded')).toBe(true)
  })

  it('does not fall back to a direct CORS request if refreshing the binding fails', async () => {
    const source = { type: 'xtream' as const, url: 'https://source.example.invalid', username: 'synthetic', password: 'source-secret' }
    const { XtreamClient } = await import('../lib/xtream')
    const key = new XtreamClient(source).seriesPrefix + '7'
    state.config.set('xtream_source', source)
    const store = usePlaylistStore()
    store.seriesIndex = [{ id: 'synthetic', serieKey: key, displayName: 'Synthetic', group: 'Series', episodeCount: 0 }]
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 503 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(store.getSeriesEpisodes(key)).rejects.toThrow('confirmar a configuração')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toContain('/config')
  })
  it('skips mixed browser fetch and makes one authenticated proxy attempt', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 451 }))
    vi.stubGlobal('fetch', fetcher)
    const store = usePlaylistStore()
    await expect(store.loadPlaylistFromUrl('http://source.example.invalid/list?password=synthetic-secret'))
      .rejects.toThrow('HTTP 451')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toBe('https://api.example.invalid/api/v1/proxy')
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer synthetic-token')
    expect(store.error).not.toContain('synthetic-secret')
    expect(store.isProcessing).toBe(false)
    expect(store.downloadDiagnostics).toEqual({ direct: 'mixed-content', proxyAttempted: true, proxyStatus: 451 })
  })

  it('does not try another access path after a direct 451', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 451 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(usePlaylistStore().loadPlaylistFromUrl('https://source.example.invalid/list'))
      .rejects.toThrow('HTTP 451')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toBe('https://source.example.invalid/list')
    expect(usePlaylistStore().downloadDiagnostics).toEqual({ direct: 'response', directStatus: 451, proxyAttempted: false })
  })

  it('keeps direct HTTP available on the native bridge', async () => {
    state.native = true
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 451 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(usePlaylistStore().loadPlaylistFromUrl('http://source.example.invalid/list'))
      .rejects.toThrow('HTTP 451')
    expect(fetcher.mock.calls[0][0]).toBe('http://source.example.invalid/list')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('separates a native connection failure from a proxy rejection without retaining the URL', async () => {
    state.native = true
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new TypeError('synthetic-secret-in-transport-error'))
      .mockResolvedValueOnce(new Response('', { status: 451 })))
    const store = usePlaylistStore()
    await expect(store.loadPlaylistFromUrl('http://source.example.invalid/list?password=synthetic-secret'))
      .rejects.toThrow('HTTP 451')
    expect(store.downloadDiagnostics).toEqual({ direct: 'network-error', proxyAttempted: true, proxyStatus: 451 })
    expect(JSON.stringify(store.downloadDiagnostics)).not.toContain('synthetic-secret')
  })

  it('does not display arbitrary restriction bodies or leave timers on network failure', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn().mockResolvedValue(new Response('{"error":"synthetic-secret"}', { status: 451 }))
    vi.stubGlobal('fetch', fetcher)
    const store = usePlaylistStore()
    await expect(store.loadPlaylistFromUrl('http://source.example.invalid/list')).rejects.toThrow('HTTP 451')
    expect(store.error).not.toContain('synthetic-secret')
    expect(vi.getTimerCount()).toBe(0)
    fetcher.mockRejectedValue(new TypeError('offline'))
    await expect(store.loadPlaylistFromUrl('http://source.example.invalid/list')).rejects.toThrow('offline')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves the import failure during initialization instead of blaming the database', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{"device_key":"SYN234","playlists_count":1,"device_token":"synthetic-token"}'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ playlists: [{
        id: 1, type: 'm3u', is_main: true, is_active: true, url: 'http://source.example.invalid/list',
      }] })))
      .mockResolvedValueOnce(new Response('', { status: 451 }))
    vi.stubGlobal('fetch', fetcher)
    const store = usePlaylistStore()
    await store.initialize()
    expect(store.error).toContain('HTTP 451')
    expect(store.isLoaded).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(state.config.get('device_token')).toBe('synthetic-token')
  })
})
