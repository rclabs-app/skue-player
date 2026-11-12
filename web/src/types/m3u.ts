export interface PlaylistItem {
  id: string
  name: string
  url: string
  group: string
  logo?: string
  tvgId?: string
  type: 'live' | 'movie' | 'series'
  /** Normalized series title used to group episodes. Only set for type=series. */
  serieKey?: string
}

/**
 * Lightweight record stored in the `series_index` IndexedDB store.
 * Represents one unique series (NOT individual episodes).
 * Avoids loading 200k episode objects into RAM.
 */
export interface SeriesEntry {
  /** Same as PlaylistItem.id of the first/representative episode */
  id: string
  /** Human-readable title (cleaned, no S01E02 suffix) */
  displayName: string
  /** Alias for compatibility with code expecting PlaylistItem.name */
  name?: string
  /** Raw M3U group-title */
  group: string
  logo?: string
  /** Normalized key used to query episodes from the playlist store */
  serieKey: string
  /** Total number of episodes available */
  episodeCount: number
}

export interface PlaylistCategory {
  id: string
  name: string
  type: 'live' | 'movie' | 'series' | 'unknown'
  count: number
}
