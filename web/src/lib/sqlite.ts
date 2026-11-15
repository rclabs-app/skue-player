import { capturePlaylistUserData } from './playlistUserData'
/**
 * SQLite-backed DatabaseService
 *
 * Drop-in replacement for the IndexedDB-based DatabaseService.
 * Uses sql.js (SQLite compiled to WASM) for all data storage,
 * providing native-level query performance:
 *
 *   - SELECT DISTINCT group_title → <5ms  (was 2-5s with IDB cursor)
 *   - SELECT ... LIMIT 50        → <1ms  (was getAll + slice)
 *   - SELECT ... WHERE name LIKE → <10ms (was full scan 3-8s)
 *   - INSERT 200k rows           → ~3s   (was 30-60s)
 *
 * Persistence: the entire .db file is saved as a binary blob via
 * OPFS (or IDB fallback) — see sqlite-persistence.ts.
 */

import initSqlJs, { type Database } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { saveDatabase, loadDatabase, deleteDatabase } from './sqlite-persistence'
import type { PlaylistItem, SeriesEntry } from '../types/m3u'

export interface HistoryItem {
  id: string
  currentTime: number
  duration: number
  watchedAt: number
}

export interface TMDBMetadata {
  id: string
  overview: string | null
  backdrop_url: string | null
  cachedAt: number
}

// ─── Schema ─────────────────────────────────────────────────────────────────

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS playlist (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  group_title TEXT DEFAULT 'Uncategorized',
  logo TEXT,
  tvg_id TEXT,
  type TEXT CHECK(type IN ('live','movie','series','unknown')),
  serie_key TEXT
);
CREATE INDEX IF NOT EXISTS idx_playlist_type ON playlist(type);
CREATE INDEX IF NOT EXISTS idx_playlist_group ON playlist(group_title);
CREATE INDEX IF NOT EXISTS idx_playlist_serie_key ON playlist(serie_key);

CREATE TABLE IF NOT EXISTS series_index (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  group_title TEXT DEFAULT 'Uncategorized',
  logo TEXT,
  serie_key TEXT UNIQUE,
  episode_count INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_series_group ON series_index(group_title);

CREATE TABLE IF NOT EXISTS favorites (id TEXT PRIMARY KEY);

CREATE TABLE IF NOT EXISTS history (
  id TEXT PRIMARY KEY,
  current_time REAL,
  duration REAL,
  watched_at INTEGER
);

CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS tmdb_cache (
  id TEXT PRIMARY KEY,
  overview TEXT,
  backdrop_url TEXT,
  cached_at INTEGER
);
`

// ─── Service ────────────────────────────────────────────────────────────────

/** Upgrade old guide storage without resetting the media catalog or user data. */
export function initializeMediaSchema(database: Database): boolean {
  database.run(SCHEMA)
  const columns = database.exec('PRAGMA table_info(playlist)')[0]?.values || []
  const oldIdentifier = columns.some(row => row[1] === 'epg_id')
  const oldGuide = !!database.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='epg'")[0]?.values.length
  const oldConfig = !!database.exec("SELECT key FROM config WHERE key='epg_url'")[0]?.values.length
  if (!oldIdentifier && !oldGuide && !oldConfig) return false

  database.run('BEGIN TRANSACTION')
  try {
    if (oldIdentifier) database.run('ALTER TABLE playlist RENAME COLUMN epg_id TO tvg_id')
    database.run('DROP TABLE IF EXISTS epg')
    database.run("DELETE FROM config WHERE key='epg_url'")
    database.run('COMMIT')
  } catch (error) {
    database.run('ROLLBACK')
    throw error
  }
  return true
}

export class SQLiteDatabaseService {
  private db: Database | null = null
  private initPromise: Promise<void> | null = null
  private persistTimer: ReturnType<typeof setTimeout> | null = null

  async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      try {
        const SQL = await initSqlJs({
          locateFile: () => wasmUrl
        })

        const saved = await loadDatabase()
        if (saved) {
          this.db = new SQL.Database(saved)
          // Run schema in case of new tables (IF NOT EXISTS = safe)
          if (initializeMediaSchema(this.db)) await this.persist()
        } else {
          this.db = new SQL.Database()
          initializeMediaSchema(this.db)
        }
      } finally {
        this.initPromise = null
      }
    })()

    return this.initPromise
  }

  /** Import a pre-built database binary (e.g. from Worker after parsing) */
  async importDatabase(data: Uint8Array): Promise<void> {
    const SQL = await initSqlJs({
      locateFile: () => wasmUrl
    })

    if (this.db) this.db.close()
    this.db = new SQL.Database(data)
    // Ensure schema is up to date
    initializeMediaSchema(this.db)
    await this.persist()
  }

  /**
   * Reload the database from the persistent store (OPFS/IDB).
   * Use after the worker has persisted a new DB so the main thread
   * gets the fresh data without the worker sending a large Uint8Array.
   */
  async reloadFromStorage(): Promise<void> {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl })
    const saved = await loadDatabase()
    if (this.db) this.db.close()
    if (saved) {
      this.db = new SQL.Database(saved)
      if (initializeMediaSchema(this.db)) await this.persist()
    } else {
      this.db = new SQL.Database()
      initializeMediaSchema(this.db)
    }
  }

  async getPlaylistUserData() {
    await this.init()
    return capturePlaylistUserData(this.db!)
  }

  async getXtreamCachedEpisodes(prefix: string): Promise<PlaylistItem[]> {
    await this.init()
    const items = this.queryPlaylistItems(
      'SELECT id,name,url,group_title,logo,tvg_id,type,serie_key FROM playlist WHERE type = ? AND serie_key LIKE ?',
      ['series', prefix + '%']
    )
    return items.filter(item => /\/\d+\.[a-zA-Z0-9]{1,8}$/.test(new URL(item.url).pathname))
  }

  /** Export the current database state to an array (for worker offloading) */
  exportDatabase(): Uint8Array | null {
    if (!this.db) return null
    return this.db.export()
  }

  /** Persist the database to OPFS/IDB immediately */
  async persist(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
    }
    if (!this.db) return
    const data = this.db.export()
    await saveDatabase(data)
  }

  /** Debounced persist — batches multiple bulk writes into one save */
  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => this.persist(), 1000)
  }

  // ─── Playlist ───────────────────────────────────────────────────────────

  /** Clear content after an explicit administrative revocation, preserving device identity. */
  async clearDeviceContent(): Promise<void> {
    if (!this.db) await this.init()
    this.db!.run('BEGIN TRANSACTION')
    try {
      for (const table of ['playlist', 'series_index', 'history', 'favorites', 'tmdb_cache']) {
        this.db!.run(`DELETE FROM ${table}`)
      }
      this.db!.run("DELETE FROM config WHERE key IN ('playlist_loaded', 'playlist_url', 'playlist_hash')")
      this.db!.run("INSERT OR REPLACE INTO config (key, value) VALUES ('device_removed', 'true')")
      this.db!.run('COMMIT')
    } catch (error) {
      this.db!.run('ROLLBACK')
      throw error
    }
    await this.persist()
  }

  async clearPlaylist(): Promise<void> {
    if (!this.db) await this.init()
    this.db!.run('DELETE FROM playlist')
    this.db!.run('DELETE FROM series_index')
    this.schedulePersist()
  }

  async savePlaylistItems(
    items: PlaylistItem[],
    onProgress?: (saved: number, total: number) => void
  ): Promise<void> {
    if (!this.db) await this.init()

    const stmt = this.db!.prepare(
      'INSERT OR REPLACE INTO playlist (id, name, url, group_title, logo, tvg_id, type, serie_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )

    this.db!.run('BEGIN TRANSACTION')
    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        stmt.run([item.id, item.name, item.url, item.group, item.logo ?? null, item.tvgId ?? null, item.type, item.serieKey ?? null])
        if (onProgress && (i + 1) % 5000 === 0) {
          onProgress(i + 1, items.length)
        }
      }
      this.db!.run('COMMIT')
    } catch (e) {
      this.db!.run('ROLLBACK')
      throw e
    } finally {
      stmt.free()
    }
    if (onProgress) onProgress(items.length, items.length)
    this.schedulePersist()
  }

  async getPlaylistItems(
    type?: 'live' | 'movie' | 'series',
    limit = 0,
    offset = 0
  ): Promise<PlaylistItem[]> {
    if (!this.db) await this.init()

    let sql = 'SELECT id, name, url, group_title, logo, tvg_id, type, serie_key FROM playlist'
    const params: any[] = []

    if (type) {
      sql += ' WHERE type = ?'
      params.push(type)
    }

    if (limit > 0) {
      sql += ' LIMIT ? OFFSET ?'
      params.push(limit, offset)
    }

    return this.queryPlaylistItems(sql, params)
  }

  async getPlaylistItemCount(type?: 'live' | 'movie' | 'series'): Promise<number> {
    if (!this.db) await this.init()

    let sql = 'SELECT COUNT(*) as cnt FROM playlist'
    const params: any[] = []

    if (type) {
      sql += ' WHERE type = ?'
      params.push(type)
    }

    const rows = this.db!.exec(sql, params)
    return rows.length > 0 ? (rows[0].values[0][0] as number) : 0
  }

  async getCategories(type: 'live' | 'movie' | 'series'): Promise<string[]> {
    if (!this.db) await this.init()

    const rows = this.db!.exec(
      'SELECT DISTINCT group_title FROM playlist WHERE type = ? ORDER BY group_title',
      [type]
    )
    if (rows.length === 0) return []
    return rows[0].values.map((row: any[]) => row[0] as string)
  }

  async getCategoriesWithCount(type: 'live' | 'movie' | 'series'): Promise<{ name: string; count: number }[]> {
    if (!this.db) await this.init()

    const rows = this.db!.exec(
      'SELECT group_title, COUNT(*) as cnt FROM playlist WHERE type = ? GROUP BY group_title ORDER BY cnt DESC',
      [type]
    )
    if (rows.length === 0) return []
    return rows[0].values.map((row: any[]) => ({ name: row[0] as string, count: row[1] as number }))
  }

  async getItemsByCategory(group: string, limit = 0, offset = 0): Promise<PlaylistItem[]> {
    if (!this.db) await this.init()

    let sql = 'SELECT id, name, url, group_title, logo, tvg_id, type, serie_key FROM playlist WHERE group_title = ?'
    const params: any[] = [group]

    if (limit > 0) {
      sql += ' LIMIT ? OFFSET ?'
      params.push(limit, offset)
    }

    return this.queryPlaylistItems(sql, params)
  }

  async getItemsByCategoryAndType(
    group: string,
    type: 'live' | 'movie' | 'series',
    limit = 0,
    offset = 0
  ): Promise<PlaylistItem[]> {
    if (!this.db) await this.init()

    let sql = 'SELECT id, name, url, group_title, logo, tvg_id, type, serie_key FROM playlist WHERE group_title = ? AND type = ?'
    const params: any[] = [group, type]

    if (limit > 0) {
      sql += ' LIMIT ? OFFSET ?'
      params.push(limit, offset)
    }

    return this.queryPlaylistItems(sql, params)
  }

  async searchItems(query: string, maxResults = 100): Promise<PlaylistItem[]> {
    if (!this.db) await this.init()

    const sql = 'SELECT id, name, url, group_title, logo, tvg_id, type, serie_key FROM playlist WHERE name LIKE ? LIMIT ?'
    return this.queryPlaylistItems(sql, [`%${query}%`, maxResults])
  }

  async searchItemsByType(
    query: string,
    type: 'live' | 'movie' | 'series',
    maxResults = 48
  ): Promise<PlaylistItem[]> {
    if (!this.db) await this.init()

    const sql = 'SELECT id, name, url, group_title, logo, tvg_id, type, serie_key FROM playlist WHERE name LIKE ? AND type = ? LIMIT ?'
    return this.queryPlaylistItems(sql, [`%${query}%`, type, maxResults])
  }

  async getPlaylistItemById(id: string): Promise<PlaylistItem | null> {
    if (!this.db) await this.init()

    const items = this.queryPlaylistItems(
      'SELECT id, name, url, group_title, logo, tvg_id, type, serie_key FROM playlist WHERE id = ?',
      [id]
    )
    return items.length > 0 ? items[0] : null
  }

  async getRecentItems(type: 'live' | 'movie' | 'series', limit = 60): Promise<PlaylistItem[]> {
    if (!this.db) await this.init()

    return this.queryPlaylistItems(
      'SELECT id, name, url, group_title, logo, tvg_id, type, serie_key FROM playlist WHERE type = ? ORDER BY rowid DESC LIMIT ?',
      [type, limit]
    )
  }

  async getTopCategories(type: 'live' | 'movie' | 'series', limit = 4): Promise<{ name: string; items: any[] }[]> {
    if (!this.db) await this.init()

    if (type === 'series') {
      const categories = await this.getSeriesCategoriesWithCount()
      const topCats = categories.slice(0, limit)
      const result: { name: string; items: SeriesEntry[] }[] = []
      for (const cat of topCats) {
        const items = await this.getSeriesByCategory(cat.name, 20)
        result.push({ name: cat.name, items })
      }
      return result
    } else {
      const categories = await this.getCategoriesWithCount(type)
      const topCats = categories.slice(0, limit)
      const result: { name: string; items: PlaylistItem[] }[] = []
      for (const cat of topCats) {
        const items = await this.getItemsByCategoryAndType(cat.name, type, 20)
        result.push({ name: cat.name, items })
      }
      return result
    }
  }

  // ─── Series Index ──────────────────────────────────────────────────────

  async saveSeriesIndex(entries: SeriesEntry[]): Promise<void> {
    if (!this.db) await this.init()

    const stmt = this.db!.prepare(
      'INSERT OR REPLACE INTO series_index (id, display_name, group_title, logo, serie_key, episode_count) VALUES (?, ?, ?, ?, ?, ?)'
    )

    this.db!.run('BEGIN TRANSACTION')
    try {
      for (const entry of entries) {
        stmt.run([entry.id, entry.displayName, entry.group, entry.logo ?? null, entry.serieKey, entry.episodeCount])
      }
      this.db!.run('COMMIT')
    } catch (e) {
      this.db!.run('ROLLBACK')
      throw e
    } finally {
      stmt.free()
    }
    this.schedulePersist()
  }

  async getSeriesIndex(limit = 0, offset = 0): Promise<SeriesEntry[]> {
    if (!this.db) await this.init()

    let sql = 'SELECT id, display_name, group_title, logo, serie_key, episode_count FROM series_index'
    const params: any[] = []

    if (limit > 0) {
      sql += ' LIMIT ? OFFSET ?'
      params.push(limit, offset)
    }

    const rows = this.db!.exec(sql, params)
    if (rows.length === 0) return []

    return rows[0].values.map((row: any[]) => ({
      id: row[0] as string,
      displayName: row[1] as string,
      group: row[2] as string,
      logo: row[3] as string | undefined,
      serieKey: row[4] as string,
      episodeCount: row[5] as number,
    }))
  }

  async getSeriesIndexCount(): Promise<number> {
    if (!this.db) await this.init()
    const rows = this.db!.exec('SELECT COUNT(*) FROM series_index')
    return rows.length > 0 ? (rows[0].values[0][0] as number) : 0
  }

  async getSeriesCategoriesWithCount(): Promise<{ name: string; count: number }[]> {
    if (!this.db) await this.init()

    const rows = this.db!.exec(
      'SELECT group_title, COUNT(*) as cnt FROM series_index GROUP BY group_title ORDER BY cnt DESC'
    )
    if (rows.length === 0) return []
    return rows[0].values.map((row: any[]) => ({ name: row[0] as string, count: row[1] as number }))
  }

  async getSeriesByCategory(group: string, limit = 0, offset = 0): Promise<SeriesEntry[]> {
    if (!this.db) await this.init()

    let sql = 'SELECT id, display_name, group_title, logo, serie_key, episode_count FROM series_index WHERE group_title = ?'
    const params: any[] = [group]

    if (limit > 0) {
      sql += ' LIMIT ? OFFSET ?'
      params.push(limit, offset)
    }

    const rows = this.db!.exec(sql, params)
    if (rows.length === 0) return []

    return rows[0].values.map((row: any[]) => ({
      id: row[0] as string,
      displayName: row[1] as string,
      group: row[2] as string,
      logo: row[3] as string | undefined,
      serieKey: row[4] as string,
      episodeCount: row[5] as number,
    }))
  }

  async getRecentSeries(limit = 60): Promise<SeriesEntry[]> {
    if (!this.db) await this.init()

    const rows = this.db!.exec(
      'SELECT id, display_name, group_title, logo, serie_key, episode_count FROM series_index ORDER BY rowid DESC LIMIT ?',
      [limit]
    )
    if (rows.length === 0) return []

    return rows[0].values.map((row: any[]) => ({
      id: row[0] as string,
      displayName: row[1] as string,
      group: row[2] as string,
      logo: row[3] as string | undefined,
      serieKey: row[4] as string,
      episodeCount: row[5] as number,
    }))
  }

  async searchSeries(query: string, maxResults = 48): Promise<SeriesEntry[]> {
    if (!this.db) await this.init()

    const rows = this.db!.exec(
      'SELECT id, display_name, group_title, logo, serie_key, episode_count FROM series_index WHERE display_name LIKE ? LIMIT ?',
      [`%${query}%`, maxResults]
    )
    if (rows.length === 0) return []

    return rows[0].values.map((row: any[]) => ({
      id: row[0] as string,
      displayName: row[1] as string,
      group: row[2] as string,
      logo: row[3] as string | undefined,
      serieKey: row[4] as string,
      episodeCount: row[5] as number,
    }))
  }

  async getEpisodesBySerieKey(serieKey: string): Promise<PlaylistItem[]> {
    if (!this.db) await this.init()

    return this.queryPlaylistItems(
      'SELECT id, name, url, group_title, logo, tvg_id, type, serie_key FROM playlist WHERE serie_key = ?',
      [serieKey]
    )
  }

  async isSeriesId(id: string): Promise<boolean> {
    if (!this.db) await this.init()
    const rows = this.db!.exec('SELECT 1 FROM series_index WHERE id = ? LIMIT 1', [id])
    return rows.length > 0 && rows[0].values.length > 0
  }

  async getSeriesById(id: string): Promise<SeriesEntry | null> {
    if (!this.db) await this.init()
    const rows = this.db!.exec(
      'SELECT id, display_name, group_title, logo, serie_key, episode_count FROM series_index WHERE id = ? LIMIT 1',
      [id]
    )
    if (rows.length === 0 || rows[0].values.length === 0) return null
    const row = rows[0].values[0]
    return {
      id: row[0] as string,
      displayName: row[1] as string,
      group: row[2] as string,
      logo: row[3] as string | undefined,
      serieKey: row[4] as string,
      episodeCount: row[5] as number,
    }
  }

  async getSeriesByKey(key: string): Promise<SeriesEntry | null> {
    if (!this.db) await this.init()
    const rows = this.db!.exec(
      'SELECT id, display_name, group_title, logo, serie_key, episode_count FROM series_index WHERE serie_key = ? LIMIT 1',
      [key]
    )
    if (rows.length === 0 || rows[0].values.length === 0) return null
    const row = rows[0].values[0]
    return {
      id: row[0] as string,
      displayName: row[1] as string,
      group: row[2] as string,
      logo: row[3] as string | undefined,
      serieKey: row[4] as string,
      episodeCount: row[5] as number,
    }
  }

  async getAllSeriesIds(): Promise<Set<string>> {
    if (!this.db) await this.init()
    const rows = this.db!.exec('SELECT id FROM series_index')
    const set = new Set<string>()
    if (rows.length > 0) {
      for (const row of rows[0].values) set.add(row[0] as string)
    }
    return set
  }

  // ─── Config ─────────────────────────────────────────────────────────────

  async saveConfig<T>(key: string, value: T): Promise<void> {
    if (!this.db) await this.init()
    this.db!.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, JSON.stringify(value)])
    await this.persist()
  }

  async getConfig<T>(key: string): Promise<T | null> {
    if (!this.db) await this.init()
    const rows = this.db!.exec('SELECT value FROM config WHERE key = ?', [key])
    if (rows.length === 0 || rows[0].values.length === 0) return null
    const raw = rows[0].values[0][0] as string
    try {
      return JSON.parse(raw) as T
    } catch {
      return raw as unknown as T
    }
  }

  // ─── History ────────────────────────────────────────────────────────────

  async saveHistoryItem(item: HistoryItem): Promise<void> {
    if (!this.db) await this.init()
    this.db!.run(
      'INSERT OR REPLACE INTO history (id, current_time, duration, watched_at) VALUES (?, ?, ?, ?)',
      [item.id, item.currentTime, item.duration, item.watchedAt]
    )
    await this.persist()
  }

  async getHistoryItems(): Promise<HistoryItem[]> {
    if (!this.db) await this.init()
    const rows = this.db!.exec('SELECT id, "current_time", duration, watched_at FROM history ORDER BY watched_at DESC')
    if (rows.length === 0) return []
    return rows[0].values.map((row: any[]) => ({
      id: row[0] as string,
      currentTime: row[1] as number,
      duration: row[2] as number,
      watchedAt: row[3] as number,
    }))
  }

  async getHistoryItem(id: string): Promise<HistoryItem | null> {
    if (!this.db) await this.init()
    const rows = this.db!.exec('SELECT id, "current_time", duration, watched_at FROM history WHERE id = ?', [id])
    if (rows.length === 0 || rows[0].values.length === 0) return null
    const row = rows[0].values[0]
    return {
      id: row[0] as string,
      currentTime: row[1] as number,
      duration: row[2] as number,
      watchedAt: row[3] as number,
    }
  }

  async clearHistory(): Promise<void> {
    if (!this.db) await this.init()
    this.db!.run('DELETE FROM history')
    await this.persist()
  }

  // ─── Favorites ──────────────────────────────────────────────────────────

  async addFavorite(id: string): Promise<void> {
    if (!this.db) await this.init()
    this.db!.run('INSERT OR IGNORE INTO favorites (id) VALUES (?)', [id])
    await this.persist()
  }

  async removeFavorite(id: string): Promise<void> {
    if (!this.db) await this.init()
    this.db!.run('DELETE FROM favorites WHERE id = ?', [id])
    await this.persist()
  }

  async getFavorites(): Promise<string[]> {
    if (!this.db) await this.init()
    const rows = this.db!.exec('SELECT id FROM favorites')
    if (rows.length === 0) return []
    return rows[0].values.map((row: any[]) => row[0] as string)
  }

  // ─── TMDB Cache ─────────────────────────────────────────────────────────

  async saveTMDBMetadata(metadata: TMDBMetadata): Promise<void> {
    if (!this.db) await this.init()
    this.db!.run(
      'INSERT OR REPLACE INTO tmdb_cache (id, overview, backdrop_url, cached_at) VALUES (?, ?, ?, ?)',
      [metadata.id, metadata.overview, metadata.backdrop_url, metadata.cachedAt]
    )
    this.schedulePersist()
  }

  async getTMDBMetadata(id: string): Promise<TMDBMetadata | null> {
    if (!this.db) await this.init()
    const rows = this.db!.exec(
      'SELECT id, overview, backdrop_url, cached_at FROM tmdb_cache WHERE id = ?',
      [id]
    )
    if (rows.length === 0 || rows[0].values.length === 0) return null
    const row = rows[0].values[0]
    return {
      id: row[0] as string,
      overview: row[1] as string | null,
      backdrop_url: row[2] as string | null,
      cachedAt: row[3] as number,
    }
  }

  // ─── Hash-based Cache Detection (Phase 4) ──────────────────────────────

  async getPlaylistHash(): Promise<string | null> {
    return this.getConfig<string>('playlist_hash')
  }

  async savePlaylistHash(hash: string): Promise<void> {
    await this.saveConfig('playlist_hash', hash)
  }

  // ─── Utility ────────────────────────────────────────────────────────────

  async deleteAll(): Promise<void> {
    if (this.db) this.db.close()
    this.db = null
    await deleteDatabase()
  }

  /** Export raw database binary */
  export(): Uint8Array | null {
    if (!this.db) return null
    return this.db.export()
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  private queryPlaylistItems(sql: string, params: any[] = []): PlaylistItem[] {
    const rows = this.db!.exec(sql, params)
    if (rows.length === 0) return []

    return rows[0].values.map((row: any[]) => ({
      id: row[0] as string,
      name: row[1] as string,
      url: row[2] as string,
      group: row[3] as string,
      logo: (row[4] as string) || undefined,
      tvgId: (row[5] as string) || undefined,
      type: row[6] as 'live' | 'movie' | 'series',
      serieKey: (row[7] as string) || undefined,
    }))
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const sqlDb = new SQLiteDatabaseService()
