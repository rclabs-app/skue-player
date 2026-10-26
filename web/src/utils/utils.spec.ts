import { describe, it, expect } from 'vitest'
import { cleanName } from './text'
import { buildPlaylistUrl } from './playlist'

describe('Utils', () => {
  describe('cleanName', () => {
    it('should strip episode notation and years from titles', () => {
      expect(cleanName('Stranger Things S01 E05')).toBe('Stranger Things')
      expect(cleanName('Breaking Bad 2x03 (2008)')).toBe('Breaking Bad')
      expect(cleanName('Inception (2010)')).toBe('Inception')
      expect(cleanName('The Matrix 1999')).toBe('The Matrix')
      expect(cleanName('Game of Thrones - Ep. 10')).toBe('Game of Thrones')
    })

    it('should leave standard titles intact', () => {
      expect(cleanName('Severance')).toBe('Severance')
    })
  })

  describe('buildPlaylistUrl', () => {
    it('should return m3u url unchanged', () => {
      const url = 'https://example.com/playlist.m3u'
      expect(buildPlaylistUrl({ type: 'm3u', url })).toBe(url)
    })

    it('should format xtream codes URL correctly', () => {
      const result = buildPlaylistUrl({
        type: 'xtream',
        url: 'https://example.com:8080/',
        username: 'user1',
        password: 'pass#123'
      })
      expect(result).toBe('https://example.com:8080/get.php?username=user1&password=pass%23123&type=m3u_plus')
    })
  })
})
