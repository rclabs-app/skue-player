import { parseM3U } from '../lib/m3u-parser'
import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { SCHEMA } from '../lib/sqlite'

self.onmessage = async (e: MessageEvent) => {
  const { content, dbData } = e.data

  if (!content) {
    self.postMessage({ type: 'error', error: 'No content provided' })
    return
  }

  try {
    self.postMessage({ type: 'progress', message: 'Parsing M3U...' })

    const result = parseM3U(content)
    const { items, seriesIndex, epgUrl } = result

    const live = items.filter(i => i.type === 'live')
    const movies = items.filter(i => i.type === 'movie')
    const seriesEpisodes = items.filter(i => i.type === 'series')

    self.postMessage({
      type: 'progress',
      message: `Parsed: ${live.length} live, ${movies.length} movies, ${seriesIndex.length} series (${seriesEpisodes.length} episodes)`
    })

    // ── Initialize SQLite ──────────────────────────────────────────────────
    self.postMessage({ type: 'progress', message: 'Iniciando banco de dados...' })
    const SQL = await initSqlJs({
      locateFile: () => wasmUrl
    })
    
    let db
    if (dbData) {
      db = new SQL.Database(dbData)
    } else {
      db = new SQL.Database()
    }
    
    // Ensure schema exists
    db.run(SCHEMA)
    
    // Clear old data
    self.postMessage({ type: 'progress', message: 'Limpando dados antigos...' })
    db.run('DELETE FROM playlist')
    db.run('DELETE FROM series_index')

    // ── Save Series Index ──────────────────────────────────────────────────
    self.postMessage({ type: 'progress', message: `Salvando Series Index (${seriesIndex.length} series)...` })
    db.run('BEGIN TRANSACTION')
    const stmtIdx = db.prepare('INSERT OR REPLACE INTO series_index (id, display_name, group_title, logo, serie_key, episode_count) VALUES (?, ?, ?, ?, ?, ?)')
    for (const s of seriesIndex) {
      stmtIdx.run([s.id, s.displayName, s.group || 'Outros', s.logo ?? null, s.serieKey ?? null, s.episodeCount])
    }
    stmtIdx.free()
    db.run('COMMIT')

    // ── Save Playlist Items ──────────────────────────────────────────────────
    db.run('BEGIN TRANSACTION')
    const stmtItem = db.prepare('INSERT OR REPLACE INTO playlist (id, name, url, group_title, logo, epg_id, type, serie_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    
    self.postMessage({ type: 'progress', message: `Salvando Canais (${live.length})...` })
    for (const item of live) {
      stmtItem.run([item.id, item.name, item.url, item.group || 'Outros', item.logo ?? null, item.epgId ?? null, item.type, item.serieKey ?? null])
    }
    
    self.postMessage({ type: 'progress', message: `Salvando Filmes (${movies.length})...` })
    for (const item of movies) {
      stmtItem.run([item.id, item.name, item.url, item.group || 'Outros', item.logo ?? null, item.epgId ?? null, item.type, item.serieKey ?? null])
    }
    
    self.postMessage({ type: 'progress', message: `Salvando Episódios (${seriesEpisodes.length})...` })
    for (const item of seriesEpisodes) {
      stmtItem.run([item.id, item.name, item.url, item.group || 'Outros', item.logo ?? null, item.epgId ?? null, item.type, item.serieKey ?? null])
    }
    
    stmtItem.free()
    db.run('COMMIT')

    // ── Export DB ────────────────────────────────────────────────────────────
    self.postMessage({ type: 'progress', message: 'Finalizando gravação do banco...' })
    const newDbData = db.export()
    db.close()

    // ── Done ─────────────────────────────────────────────────────────────────
    self.postMessage({
      type: 'done',
      epgUrl,
      dbData: newDbData,
      counts: {
        live: live.length,
        movie: movies.length,
        series: seriesEpisodes.length,
        seriesIndex: seriesIndex.length
      }
    }, [newDbData.buffer] as any) // Zero-copy transfer!

  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error during parsing'
    })
  }
}
