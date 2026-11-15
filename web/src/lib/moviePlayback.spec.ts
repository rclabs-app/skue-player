import { describe, expect, it } from 'vitest'
import { movieReference, validMovieGatewayUrl } from './moviePlayback'
const source = { type: 'xtream' as const, url: 'http://source.example.invalid/sub', username: 'test user', password: 'test/secret' }
describe('movie ticket references', () => {
  it('identifies the exact configured account without passing its credentials', () => {
    expect(movieReference('http://source.example.invalid/sub/movie/test%20user/test%2Fsecret/123.mp4', source)).toEqual({ stream_id: '123', extension: 'mp4' })
  })
  it('rejects another account, host, protocol, arbitrary URL, path and unsupported format', () => {
    const prefix = 'http://source.example.invalid/sub/movie/test%20user/test%2Fsecret/'
    for (const url of ['http://elsewhere.invalid/movie/1.mp4', prefix + '123.m3u8', prefix + '123.mp4?secret=x', prefix + '../123.mp4', prefix.replace('test%20user', 'other') + '123.mp4', prefix.replace('http:', 'https:') + '123.mp4']) expect(movieReference(url, source)).toBeNull()
  })
  it('accepts only the encrypted HTTPS gateway contract', () => {
    const path = '/v1/media.mp4?ticket=' + 'a'.repeat(40)
    expect(validMovieGatewayUrl('https://media.example.invalid' + path)).toBe(true)
    for (const url of ['http://media.example.invalid' + path, 'https://user:pass@media.example.invalid' + path, 'https://media.example.invalid/movie.mp4', 'not a url']) expect(validMovieGatewayUrl(url)).toBe(false)
  })
})
