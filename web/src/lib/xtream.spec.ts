import { afterEach, describe, expect, it, vi } from 'vitest'
import { XtreamClient } from './xtream'
import { parseM3U } from './m3u-parser'
const config = { type: 'xtream' as const, url: 'https://source.example.invalid', username: 'u &', password: 'secret/+' }
const auth = { user_info: { auth: 1, status: 'Active', allowed_output_formats: ['ts', 'm3u8'] } }
function serve(overrides: Record<string, unknown> = {}) {
  const responses: Record<string, unknown> = {
    auth,
    get_live_categories: [{ category_id: '10', category_name: 'Canais' }],
    get_live_streams: [{ stream_id: 1, name: 'Live', category_id: 10 }],
    get_vod_categories: [{ category_id: 20, category_name: 'Filmes' }],
    get_vod_streams: [{ stream_id: 2, name: 'Movie', category_id: '20', container_extension: 'mkv' }],
    get_series_categories: [{ category_id: '30', category_name: 'Séries' }],
    get_series: [{ series_id: 3, name: 'Show', category_id: '30', cover: 'https://example.invalid/image.jpg' }],
    get_series_info: { episodes: { '2': [{ id: 4, episode_num: 1, container_extension: 'mp4' }] } },
    ...overrides,
  }
  const fetcher = vi.fn(async (input: string, _options?: RequestInit) => {
    const action = new URL(input).searchParams.get('action') || 'auth'
    const value = responses[action]
    return value instanceof Response ? value : new Response(JSON.stringify(value))
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('direct Xtream import', () => {
  it('uses authenticated metadata transport for episodes without a second direct source request', async () => {
    const fetcher = serve()
    const metadata = vi.fn().mockResolvedValue({ episodes: { '1': [{ id: 8, episode_num: 1, container_extension: 'mp4' }] } })
    const client = new XtreamClient(config)
    const episodes = await client.episodes(`${client.seriesPrefix}3`, 'Synthetic', 'Series', metadata)
    expect(metadata).toHaveBeenCalledWith('3')
    expect(episodes[0].url).toContain('/8.mp4')
    expect(fetcher).not.toHaveBeenCalled()
    metadata.mockRejectedValue(new Error('HTTP 451'))
    await expect(client.episodes(`${client.seriesPrefix}3`, 'Synthetic', 'Series', metadata)).rejects.toThrow('451')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('authenticates and streams categories, live, VOD and a lazy series without get.php or episode crawling', async () => {
    const fetcher = serve()
    const client = new XtreamClient(config)
    const parsed = parseM3U(await (await client.playlistResponse()).text())
    expect(parsed.items).toHaveLength(3)
    expect(parsed.items.map(i => i.type)).toEqual(['live', 'movie', 'series'])
    expect(parsed.items[0].group).toBe('Canais')
    expect(parsed.items[0].url).toContain('/live/u%20%26/secret%2F%2B/1.m3u8')
    expect(parsed.items[1].url).toContain('/movie/u%20%26/secret%2F%2B/2.mkv')
    expect(parsed.seriesIndex[0]).toMatchObject({ displayName: 'Show', serieKey: `${client.seriesPrefix}3`, episodeCount: 0 })
    expect(fetcher).toHaveBeenCalledTimes(7)
    for (const [url, options] of fetcher.mock.calls) {
      expect(url).not.toContain('get.php')
      expect(new URL(url).searchParams.get('password')).toBe(config.password)
      expect(options).toMatchObject({ credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' })
    }
  })

  it('fetches episodes only on demand with separate seasons and stable identity', async () => {
    const fetcher = serve()
    const client = new XtreamClient(config)
    const key = `${client.seriesPrefix}3`
    const first = await client.episodes(key, 'Show', 'Séries')
    const second = await client.episodes(key, 'Show', 'Séries')
    expect(first[0]).toMatchObject({ name: 'Show S02E01', type: 'series', serieKey: key })
    expect(first[0].url).toContain('/series/u%20%26/secret%2F%2B/4.mp4')
    expect(first[0].id).toBe(second[0].id)
    expect(fetcher).toHaveBeenCalledTimes(2)
    await expect(client.episodes('xc:other:3', 'Show', 'Séries')).rejects.toThrow('outra configuração')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('stops after an explicit restriction without another host, protocol or import path, and hides its body', async () => {
    const fetcher = serve({ auth: new Response('secret-should-not-leak', { status: 451 }) })
    await expect(new XtreamClient(config).playlistResponse()).rejects.toThrow('HTTP 451')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does not import after rejected authentication or invalid category data', async () => {
    const fetcher = serve({ auth: { user_info: { auth: 0 } } })
    await expect(new XtreamClient(config).playlistResponse()).rejects.toThrow('inválida')
    expect(fetcher).toHaveBeenCalledTimes(1)
    serve({ get_live_categories: { unexpected: 'private upstream message' } })
    const response = await new XtreamClient(config).playlistResponse()
    await expect(response.text()).rejects.toThrow('catálogo Xtream válido')
  })

  it('rejects an empty catalog, never presenting an empty replacement as success', async () => {
    serve({ get_live_streams: [], get_vod_streams: {}, get_series: [] })
    await expect((await new XtreamClient(config).playlistResponse()).text()).rejects.toThrow('catálogo anterior foi preservado')
  })

  it('rejects an expired account and stops on a mid-catalog 451 without switching to M3U', async () => {
    const expired = serve({ auth: { user_info: { auth: 1, status: 'Expired' } } })
    await expect(new XtreamClient(config).playlistResponse()).rejects.toThrow('expirada')
    expect(expired).toHaveBeenCalledTimes(1)
    const restricted = serve({ get_vod_streams: new Response('private body', { status: 451 }) })
    await expect((await new XtreamClient(config).playlistResponse()).text()).rejects.toThrow('451')
    expect(restricted).toHaveBeenCalledTimes(5)
    expect(restricted.mock.calls.every(([url]) => new URL(url).pathname === '/player_api.php')).toBe(true)
  })

  it('sanitizes provider attributes and ignores nonnumeric item IDs', async () => {
    serve({ get_live_streams: [{ stream_id: 1, name: 'Name\n#EXTINF:bad', category_id: 10 }, { stream_id: '../bad', name: 'Bad' }] })
    const parsed = parseM3U(await (await new XtreamClient(config).playlistResponse()).text())
    expect(parsed.items).toHaveLength(3)
    expect(parsed.items[0].name).not.toContain('\n')
  })

  it('does not retain raw transport errors and clears request timers', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private-url-secret')))
    await expect(new XtreamClient(config).playlistResponse()).rejects.toThrow('CORS')
    expect(vi.getTimerCount()).toBe(0)
    expect(() => new XtreamClient({ ...config, url: 'file:///tmp/list' })).toThrow('Confira')
  })
})
