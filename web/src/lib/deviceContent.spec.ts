import { describe, expect, it, vi } from 'vitest'
import { resolve } from 'node:path'
import initSqlJs from 'sql.js'
import { SQLiteDatabaseService } from './sqlite'

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
  it('clears content across reloads while retaining token and unrelated settings', async () => {
    const db = new SQLiteDatabaseService()
    await db.init()
    const SQL = await initSqlJs()
    const fixture = new SQL.Database(db.exportDatabase()!)
    fixture.run("INSERT INTO playlist (id, name, url) VALUES ('test-content', 'Test', 'https://example.com/test')")
    fixture.run("INSERT INTO series_index (id, display_name) VALUES ('test-content', 'Test')")
    for (const table of ['history', 'favorites', 'epg', 'tmdb_cache']) {
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
    for (const table of ['playlist', 'series_index', 'history', 'favorites', 'epg', 'tmdb_cache']) {
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
