import { describe, expect, it, vi } from 'vitest'
import { resolve } from 'node:path'
import initSqlJs from 'sql.js'
import { SCHEMA, SQLiteDatabaseService } from './sqlite'

const persistence = vi.hoisted(() => ({ data: null as Uint8Array | null }))
vi.mock('./sqlite-persistence', () => ({
  loadDatabase: vi.fn(async () => persistence.data),
  saveDatabase: vi.fn(async (data: Uint8Array) => { persistence.data = data.slice() }),
  deleteDatabase: vi.fn(),
}))
vi.mock('sql.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sql.js')>()
  return { default: () => actual.default({ locateFile: () => resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm') }) }
})

describe('persistent device cleanup', () => {
  it('migrates legacy guide data while retaining catalog, usage and identity across reloads', async () => {
    const SQL = await initSqlJs()
    const legacy = new SQL.Database()
    legacy.run(SCHEMA.replace('tvg_id TEXT', 'epg_id TEXT'))
    legacy.run('CREATE TABLE epg (id TEXT PRIMARY KEY, title TEXT)')
    legacy.run("INSERT INTO epg VALUES ('old-program', 'Synthetic program')")
    legacy.run("INSERT INTO playlist (id,name,url,epg_id,type) VALUES ('live-1','Channel','https://example.invalid/live/1','channel-1','live')")
    legacy.run("INSERT INTO history VALUES ('live-1',12,60,123)")
    legacy.run("INSERT INTO favorites VALUES ('live-1')")
    legacy.run("INSERT INTO config VALUES ('device_token','synthetic-token'), ('theme','dark'), ('epg_url','https://example.invalid/old.xml')")
    persistence.data = legacy.export()
    legacy.close()

    const service = new SQLiteDatabaseService()
    await service.init()
    expect(await service.getConfig('epg_url')).toBeNull()
    expect(await service.getConfig('device_token')).toBe('synthetic-token')
    expect(await service.getConfig('theme')).toBe('dark')
    expect((await service.getPlaylistItems('live'))[0]).toMatchObject({ id: 'live-1', tvgId: 'channel-1', type: 'live' })
    expect((await service.getHistoryItem('live-1'))?.currentTime).toBe(12)
    expect(await service.getFavorites()).toEqual(['live-1'])

    const persisted = new SQL.Database(persistence.data!)
    expect(persisted.exec("SELECT name FROM sqlite_master WHERE name='epg'")).toEqual([])
    expect(persisted.exec('PRAGMA table_info(playlist)')[0].values.map(row => row[1])).not.toContain('epg_id')
    const sizeAfterMigration = persistence.data!.length
    persisted.close()
    const reloaded = new SQLiteDatabaseService()
    await reloaded.init()
    expect(await reloaded.getFavorites()).toEqual(['live-1'])
    expect((await reloaded.getPlaylistItems('live'))[0].tvgId).toBe('channel-1')
    expect(persistence.data!.length).toBe(sizeAfterMigration)
  })

  it('clears content across reloads while retaining token and unrelated settings', async () => {
    const db = new SQLiteDatabaseService()
    await db.init()
    const SQL = await initSqlJs()
    const fixture = new SQL.Database(db.exportDatabase()!)
    fixture.run("INSERT INTO playlist (id, name, url) VALUES ('test-content', 'Test', 'https://example.com/test')")
    fixture.run("INSERT INTO series_index (id, display_name) VALUES ('test-content', 'Test')")
    for (const table of ['history', 'favorites', 'tmdb_cache']) {
      fixture.run(`INSERT INTO ${table} (id) VALUES ('test-content')`)
    }
    await db.importDatabase(fixture.export())
    fixture.close()
    await db.saveConfig('device_token', 'synthetic-existing-token')
    await db.saveConfig('theme', 'dark')
    await db.saveConfig('playlist_loaded', true)
    await db.saveConfig('playlist_url', 'https://example.com/list')
    await db.clearDeviceContent()
    const reloaded = new SQLiteDatabaseService()
    await reloaded.init()
    const actual = new SQL.Database(reloaded.exportDatabase()!)
    for (const table of ['playlist', 'series_index', 'history', 'favorites', 'tmdb_cache']) {
      expect(actual.exec(`SELECT COUNT(*) FROM ${table}`)[0].values[0][0]).toBe(0)
    }
    actual.close()
    expect(await reloaded.getConfig('device_token')).toBe('synthetic-existing-token')
    expect(await reloaded.getConfig('theme')).toBe('dark')
    expect(await reloaded.getConfig('device_removed')).toBe(true)
    expect(await reloaded.getConfig('playlist_loaded')).not.toBe(true)
    expect(await reloaded.getConfig('playlist_url')).toBeNull()
  })
})
