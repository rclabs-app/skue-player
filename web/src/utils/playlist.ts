/**
 * Utility functions for playlist URL construction and handling.
 */

export interface PlaylistConfig {
  type: 'm3u' | 'xtream'
  url: string
  username?: string
  password?: string
}

/**
 * Builds the final M3U URL for a playlist.
 * For Xtream playlists, constructs the get.php URL with credentials.
 * For M3U playlists, returns the URL as-is.
 */
export function buildPlaylistUrl(playlist: PlaylistConfig): string {
  if (playlist.type === 'xtream') {
    const baseUrl = playlist.url.replace(/\/$/, '')
    const user = encodeURIComponent(playlist.username || '')
    const pass = encodeURIComponent(playlist.password || '')
    return `${baseUrl}/get.php?username=${user}&password=${pass}&type=m3u_plus`
  }
  return playlist.url
}
