import { describe, it, expect, vi } from 'vitest'
import { resolve } from 'node:path'
import initSqlJs from 'sql.js'
import { SCHEMA, SQLiteDatabaseService } from './sqlite'
import { capturePlaylistUserData, restorePlaylistUserData } from './playlistUserData'
import { contentId } from './contentIdentity'
import { parseM3U } from './m3u-parser'
vi.mock('./sqlite-persistence', () => ({ saveDatabase: vi.fn(), loadDatabase: vi.fn(), deleteDatabase: vi.fn() }))
vi.mock('sql.js', async importOriginal => {
  const actual = await importOriginal<typeof import('sql.js')>()
  return { default: () => actual.default({ locateFile: () => resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm') }) }
})
const movie = '#EXTINF:-1 group-title="Filmes",Movie\nhttps://example.com/movie/1.mp4\n'
const other = '#EXTINF:-1 group-title="Filmes",Other\nhttps://example.com/movie/2.mp4\n'
const channel = '#EXTINF:-1 tvg-id="channel-1" group-title="Filmes",Synthetic channel\nhttps://example.invalid/watch/1\n'
describe('playlist import continuity', () => {
  it('ignores guide headers while retaining tvg-id classification and stable content identity', () => {
    const parsed = parseM3U('#EXTM3U x-tvg-url="https://example.invalid/old.xml"\n' + channel + movie)
    expect(parsed).not.toHaveProperty('epgUrl')
    expect(parsed.items[0]).toMatchObject({ type: 'live', tvgId: 'channel-1' })
    expect(parsed.items[1].type).toBe('movie')
    expect(parsed.items[0].id).toBe(parseM3U('#EXTM3U\n' + channel).items[0].id)
  })
  it('keeps IDs stable on reorder and separates sources', () => {
    const before = parseM3U('#EXTM3U\n' + movie + other)
    const after = parseM3U('#EXTM3U\n' + other + movie)
    expect(before.items[0].id).toBe(after.items[1].id)
    expect(contentId('https://other.example/movie/1.mp4', 'Movie')).not.toBe(before.items[0].id)
  })
  it('worker migrates usage and settings through real SQL export and reload', async () => {
    const SQL = await initSqlJs()
    const old = new SQL.Database()
    old.run(SCHEMA)
    old.run("INSERT INTO playlist (id,name,url,type) VALUES ('legacy-42','Movie','https://example.com/movie/1.mp4','movie')")
    old.run("INSERT INTO history VALUES ('legacy-42',300,1000,123)")
    old.run("INSERT INTO favorites VALUES ('legacy-42')")
    old.run("INSERT INTO config VALUES ('theme','dark')")
    old.run("INSERT INTO config VALUES ('epg_url','https://example.invalid/old.xml')")
    old.run("INSERT INTO tmdb_cache VALUES ('legacy-42','Overview',NULL,123)")
    const userData = capturePlaylistUserData(old)
    expect(userData.config?.some(row => row[0] === 'epg_url')).toBe(false)
    // Simulate an older client sending the obsolete setting to the new worker.
    userData.config!.push(['epg_url', 'https://example.invalid/old.xml'])
    old.close()
    let saved: Uint8Array | undefined
    const postMessage = vi.fn()
    const scope = {
      postMessage,
      onmessage: null as unknown as (e: { data: unknown }) => Promise<void>,
      navigator: { storage: { getDirectory: async () => ({ getFileHandle: async () => ({ createWritable: async () => ({
        write: async (data: Uint8Array) => { saved = data.slice() }, close: async () => {},
      }) }) }) } },
    }
    vi.stubGlobal('self', scope)
    try {
      await import('../workers/m3u-parser.worker')
      await scope.onmessage({ data: { type: 'init', userData, retainedEpisodes: [
        { id: 'cached-episode', name: 'Show S01E01', url: 'https://example.invalid/series/user/pass/4.mp4', group: 'Séries', type: 'series', serieKey: 'xc:vod2-test-source:3' },
        { id: 'absent-series-episode', name: 'Old S01E01', url: 'https://example.invalid/series/user/pass/5.mp4', group: 'Séries', type: 'series', serieKey: 'xc:vod2-test-source:99' },
      ] } })
      await scope.onmessage({ data: { type: 'chunk', data: new TextEncoder().encode('#EXTM3U url-tvg="https://example.invalid/old.xml"\n' + other + movie + channel + '#EXTINF:-1 skue-series-key="xc:vod2-test-source:3",Show\nhttps://example.invalid/series/user/pass/3\n') } })
      await scope.onmessage({ data: { type: 'end' } })
      expect(postMessage.mock.calls.some(([m]) => m.type === 'error')).toBe(false)
      expect(saved).toBeDefined()
      const restored = new SQL.Database(saved!)
      expect(restored.exec("SELECT serie_key,episode_count FROM series_index WHERE display_name='Show'")[0].values).toEqual([['xc:vod2-test-source:3',1]])
      expect(restored.exec("SELECT id FROM playlist WHERE id='cached-episode'")[0].values).toEqual([['cached-episode']])
      expect(restored.exec("SELECT id FROM playlist WHERE id='absent-series-episode'")).toEqual([])
      expect(postMessage.mock.calls.find(([m]) => m.type === 'done')?.[0]).not.toHaveProperty('epgUrl')
      expect(restored.exec("SELECT value FROM config WHERE key='epg_url'")).toEqual([])
      expect(restored.exec("SELECT tvg_id,type FROM playlist WHERE name='Synthetic channel'")[0].values).toEqual([['channel-1','live']])
      const service = new SQLiteDatabaseService()
      await service.importDatabase(saved!)
      expect((await service.getHistoryItems())[0].currentTime).toBe(300)
      expect((await service.getHistoryItem(contentId('https://example.com/movie/1.mp4', 'Movie')))?.currentTime).toBe(300)
      const id = contentId('https://example.com/movie/1.mp4', 'Movie')
      expect(restored.exec('SELECT h.id,h.current_time FROM history h JOIN playlist p ON p.id=h.id')[0].values).toEqual([[id,300]])
      expect(restored.exec('SELECT id FROM favorites')[0].values).toEqual([[id]])
      expect(restored.exec('SELECT id FROM tmdb_cache')[0].values).toEqual([[id]])
      expect(restored.exec("SELECT value FROM config WHERE key='theme'")[0].values).toEqual([['dark']])
      const next = new SQL.Database()
      next.run(SCHEMA)
      restorePlaylistUserData(next, capturePlaylistUserData(restored))
      expect(next.exec('SELECT h.current_time FROM history h')[0].values).toEqual([[300]])
      next.close()
      restored.close()
    } finally { vi.unstubAllGlobals() }
  })
})
