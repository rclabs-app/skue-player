import { db } from '../lib/database'
import type { TMDBMetadata } from '../lib/database'

import { getApiUrl } from '../utils/api'

export class TMDBService {
  /**
   * Fetches metadata for an item. Checks the IndexedDB cache first.
   * If cache is missing or stale (older than 7 days), queries the backend proxy.
   */
  static async getMetadata(id: string, name: string, type: 'movie' | 'series'): Promise<TMDBMetadata> {
    try {
      const cached = await db.getTMDBMetadata(id)
      const sevenDays = 7 * 24 * 60 * 60 * 1000
      
      if (cached && (Date.now() - cached.cachedAt) < sevenDays) {
        return cached
      }
      
      // Sanitizer to extract cleaned title and year (e.g. "Inception (2010)" -> "Inception", year "2010")
      const yearMatch = name.match(/\(?(\d{4})\)?$/)
      const year = yearMatch ? yearMatch[1] : undefined

      const cleanTitle = name
        .replace(/\s*[-–]?\s*S\d{1,3}\s*E\d{1,3}.*$/i, '')
        .replace(/\s*\d{1,3}x\d{1,3}.*$/i, '')
        .replace(/\s*[-–]\s*Ep[.:]?\s*\d+.*$/i, '')
        .replace(/[\[\](){}]/g, ' ')
        .replace(/\b(?:1080p|720p|2160p|4k|hd|fullhd|hdtv|web[ -]?dl|webrip|bluray|brrip|dvdrip|x264|x265|h264|h265|repack|proper|extended)\b.*$/i, '')
        .replace(/\s*\(?\d{4}\)?\s*$/, '')
        .replace(/\s{2,}/g, ' ')
        .trim()

      const targetUrl = getApiUrl('/api/v1/tmdb/metadata')
      const url = new URL(targetUrl.startsWith('http') ? targetUrl : `${window.location.origin}${targetUrl}`)
      url.searchParams.append('title', cleanTitle)
      url.searchParams.append('type', type)
      if (year) {
        url.searchParams.append('year', year)
      }

      // Fetch headers (attach token if authenticated)
      const headers: Record<string, string> = { 'Accept': 'application/json' }
      const token = await db.getConfig('device_token')
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(url.toString(), { headers })
      if (!response.ok) {
        throw new Error(`Failed to fetch from TMDB proxy: ${response.status}`)
      }

      const data = await response.json()
      
      const result: TMDBMetadata = {
        id,
        overview: data.overview || null,
        backdrop_url: data.backdrop_url || null,
        cachedAt: Date.now()
      }

      await db.saveTMDBMetadata(result)
      return result
    } catch (err) {
      console.warn('TMDB Fetch fallback: ', err)
      return {
        id,
        overview: null,
        backdrop_url: null,
        cachedAt: Date.now()
      }
    }
  }
}
