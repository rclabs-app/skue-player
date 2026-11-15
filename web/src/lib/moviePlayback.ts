import type { PlaylistConfig } from '../utils/playlist'

/** Extract only an ID/format from a movie belonging to this configured account. */
export function movieReference(value: string, source: PlaylistConfig): { stream_id: string; extension: string } | null {
  if (source.type !== 'xtream' || !source.username || !source.password) return null
  try {
    const base = new URL(source.url.replace(/\/+$/, '') + '/')
    const url = new URL(value)
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash
      || url.origin !== base.origin || url.search || url.hash || url.username || url.password) return null
    const prefix = new URL(`movie/${encodeURIComponent(source.username)}/${encodeURIComponent(source.password)}/`, base).pathname
    if (!url.pathname.startsWith(prefix)) return null
    const match = /^(\d{1,15})\.(mp4|m4v|webm)$/.exec(url.pathname.slice(prefix.length))
    return match ? { stream_id: match[1]!, extension: match[2]! } : null
  } catch { return null }
}

export function validMovieGatewayUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash
      && /^\/v1\/media\.(mp4|m4v|webm)$/.test(url.pathname)
      && /^[A-Za-z0-9_-]{30,8192}$/.test(url.searchParams.get('ticket') || '')
  } catch { return false }
}
