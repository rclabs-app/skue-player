import type { Database, SqlValue } from 'sql.js'
import { contentId } from './contentIdentity'

const tables = {
  history: ['id', 'current_time', 'duration', 'watched_at'],
  favorites: ['id'],
  tmdb_cache: ['id', 'overview', 'backdrop_url', 'cached_at'],
  config: ['key', 'value'],
} as const
export type PlaylistUserData = Partial<Record<keyof typeof tables, SqlValue[][]>>

/** Transfer only user data, migrating old position-dependent IDs via the old catalog. */
export function capturePlaylistUserData(db: Database): PlaylistUserData {
  const result: PlaylistUserData = {}
  for (const table of ['history', 'favorites', 'tmdb_cache'] as const) {
    const columns = tables[table].map(c => `u.${c}`).join(', ')
    const rows = db.exec(`SELECT ${columns}, p.url, p.name FROM ${table} u LEFT JOIN playlist p ON p.id = u.id`)[0]?.values || []
    result[table] = rows.map(row => {
      const values = row.slice(0, tables[table].length)
      const url = row[tables[table].length]
      const name = row[tables[table].length + 1]
      if (typeof url === 'string' && typeof name === 'string') values[0] = contentId(url, name)
      return values
    })
    // If old duplicate entries map to one identity, newest progress wins.
    if (table === 'history') result[table]!.sort((a, b) => Number(a[3]) - Number(b[3]))
  }
  result.config = db.exec("SELECT key, value FROM config WHERE key <> 'epg_url'")[0]?.values || []
  return result
}

export function restorePlaylistUserData(db: Database, data: PlaylistUserData): void {
  for (const table of Object.keys(tables) as Array<keyof typeof tables>) {
    const columns = tables[table]
    const stmt = db.prepare(`INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`)
    try {
      for (const row of data[table] || []) {
        if (table === 'config' && row[0] === 'epg_url') continue
        stmt.run(row)
      }
    } finally { stmt.free() }
  }
}
