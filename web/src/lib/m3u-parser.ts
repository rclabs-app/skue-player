import { contentId } from './contentIdentity'
import type { PlaylistItem, SeriesEntry } from '../types/m3u'

export interface ParsedPlaylist {
  items: PlaylistItem[]
  seriesIndex: SeriesEntry[]
}

/**
 * Parses M3U content without building a full string array upfront.
 * 
 * Key optimizations vs the original:
 * 1. Line-by-line scan with indexOf instead of split('\n') — avoids allocating
 *    200k+ string objects in one shot on TV's constrained heap.
 * 2. For series items, only the first-seen episode per serieKey is kept in
 *    the returned `items` array; all episodes get a serieKey stamp and are
 *    returned separately so the caller can save them to IDB without loading
 *    them all into React/Vue state.
 * 3. Builds the SeriesEntry index (deduped series for the grid) inline while
 *    scanning — O(n) single pass.
 */
export function parseM3U(content: string): ParsedPlaylist {
  const items: PlaylistItem[] = []
  const seriesMap = new Map<string, SeriesEntry>()

  let currentItem: Partial<PlaylistItem> | null = null
  let pos = 0
  const len = content.length

  while (pos < len) {
    // Find end of current line
    let end = content.indexOf('\n', pos)
    if (end === -1) end = len
    // Trim \r if present (Windows line endings)
    const lineEnd = end > pos && content[end - 1] === '\r' ? end - 1 : end
    const line = content.slice(pos, lineEnd).trim()
    pos = end + 1

    if (!line) continue

    if (line.startsWith('#EXTINF:')) {
      currentItem = parseExtInf(line)
    } else if (line[0] === '#') {
      // Skip other directives
      continue
    } else if (currentItem) {
      currentItem.url = line
      currentItem.type = determineType(currentItem as PlaylistItem)
      currentItem.id = contentId(line, currentItem.name || '')

      if (currentItem.type === 'series') {
        // Compute the normalized key for this series
        const key = currentItem.serieKey || buildSerieKey(currentItem.name || '')
        currentItem.serieKey = key

        const existing = seriesMap.get(key)
        if (!existing) {
          // First episode seen for this series → create the series entry
          seriesMap.set(key, {
            id: currentItem.id as string,
            displayName: cleanNameInline(currentItem.name || ''),
            group: currentItem.group || 'Uncategorized',
            logo: currentItem.logo,
            serieKey: key,
            episodeCount: key.startsWith('xc:') ? 0 : 1,
          })
        } else {
          existing.episodeCount++
          // Prefer an episode that has a logo over one that doesn't
          if (!existing.logo && currentItem.logo) existing.logo = currentItem.logo
        }
      }

      items.push(currentItem as PlaylistItem)
      currentItem = null
    }
  }

  return { items, seriesIndex: Array.from(seriesMap.values()) }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseExtInf(line: string): Partial<PlaylistItem> {
  const item: Partial<PlaylistItem> = {
    group: 'Uncategorized'
  }

  const attrRegex = /([a-zA-Z0-9-]+)="([^"]*)"/g
  let match
  while ((match = attrRegex.exec(line)) !== null) {
    const key = match[1]
    const value = match[2]
    if (key === 'group-title') item.group = value
    else if (key === 'tvg-logo') item.logo = value
    else if (key === 'tvg-id') item.tvgId = value
    else if (key === 'skue-series-key' && /^xc:vod2-[a-z0-9]+-[a-z0-9]+:\d+$/.test(value)) item.serieKey = value
  }

  const commaIndex = line.lastIndexOf(',')
  item.name = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : 'Unknown'

  return item
}

function determineType(item: Partial<PlaylistItem>): 'live' | 'movie' | 'series' {
  const url = item.url || ''
  const group = item.group || ''
  const name = item.name || ''
  const lowerUrl = url.toLowerCase()
  if (lowerUrl) {
    if (lowerUrl.includes('/movie/')) return 'movie'
    if (lowerUrl.includes('/series/')) return 'series'
    if (lowerUrl.includes('/live/')) return 'live'
    
    // Explicit extensions
    if (lowerUrl.endsWith('.ts') || lowerUrl.endsWith('.m3u8')) return 'live'
  }

  // A nonempty tvg-id is also used to recognize live channels.
  if (item.tvgId && item.tvgId.trim() !== '') {
    return 'live'
  }

  const lowerGroup = group.toLowerCase()
  const lowerName = name.toLowerCase()

  // Priority 1: Strong Live TV indicators that override any movie/series keywords
  const groupLivePriorityKw = ['24h', '24 h', '24 horas', 'canais', 'ao vivo', 'pay-per-view', 'premiere', 'esportes', 'sports', 'futebol', 'campeonato', 'copa', 'combate', 'ufc', 'conmebol', 'abertos']
  if (groupLivePriorityKw.some(kw => lowerGroup.includes(kw))) return 'live'

  // Priority 2: Strong Series/Movie indicators
  const groupSeriesKw = ['serie', 'série', 'animes', 'dorama', 'novela']
  if (groupSeriesKw.some(kw => lowerGroup.includes(kw))) return 'series'

  const groupMovieKw = ['movie', 'filme', 'vod', 'cinema', 'lançamento']
  if (groupMovieKw.some(kw => lowerGroup.includes(kw))) return 'movie'

  // Priority 3: Secondary Live TV indicators (like TV networks)
  const groupLiveSecondaryKw = ['noticias', 'notícias', 'religiosos', 'globo', 'sbt', 'record', 'band', 'telecine', 'hbo']
  if (groupLiveSecondaryKw.some(kw => lowerGroup.includes(kw))) return 'live'

  // Priority 4: Name-based checks (if group was empty or unrecognized)
  
  // Explicit live keywords in the name itself
  const nameLiveKw = ['ao vivo', 'pay-per-view', 'premiere', 'brasileirao', 'brasileirão', 'combate', 'conmebol', '24h']
  if (nameLiveKw.some(kw => lowerName.includes(kw))) return 'live'

  // Series indicators in name (S01E01 pattern)
  if (/S\d{1,2}\s*E\d{1,3}/i.test(name) || /\d{1,2}x\d{1,3}/i.test(name) || /Ep\.?\s*\d+/i.test(name)) {
    return 'series'
  }

  // Fallback name keywords
  const nameSeriesKw = ['season', 'episodio', 'episode', 'serie', 'série']
  if (nameSeriesKw.some(kw => lowerName.includes(kw))) return 'series'
  
  const strictMovieKw = ['movie', 'filme']
  if (strictMovieKw.some(kw => lowerName.includes(kw))) return 'movie'

  // Default fallback for items with no explicit classification (most likely Live TV in Xtream Codes)
  return 'live'
}

/**
 * Strips episode notation to get the base series title, used as grouping key.
 * Must be consistent with text.ts cleanName() — kept inline to avoid
 * importing the Vue-side module from within the parser lib.
 */
function buildSerieKey(name: string): string {
  return name
    .replace(/\s*[-–]?\s*S\d{1,3}\s*E\d{1,3}.*$/i, '')
    .replace(/\s*\d{1,3}x\d{1,3}.*$/i, '')
    .replace(/\s*-\s*Ep[.:]?\s*\d+.*$/i, '')
    .replace(/\s*\(\d{4}\)\s*$/i, '')
    .replace(/\s+\d{4}$/i, '')
    .trim()
    .toLowerCase()
}

/** Same as buildSerieKey but preserves original casing for display. */
function cleanNameInline(name: string): string {
  return name
    .replace(/\s*[-–]?\s*S\d{1,3}\s*E\d{1,3}.*$/i, '')
    .replace(/\s*\d{1,3}x\d{1,3}.*$/i, '')
    .replace(/\s*-\s*Ep[.:]?\s*\d+.*$/i, '')
    .replace(/\s*\(\d{4}\)\s*$/i, '')
    .replace(/\s+\d{4}$/i, '')
    .trim()
}
