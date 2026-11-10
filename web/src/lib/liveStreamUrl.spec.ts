import { afterEach, describe, expect, it, vi } from 'vitest'
import { getLiveHlsAlternative, probeLiveHlsManifest } from './liveStreamUrl'

describe('live HLS alternative', () => {
  it('recognizes extensionless and explicit live TS routes without changing origin or credentials', () => {
    expect(getLiveHlsAlternative('https://example.com:8443/user/p%40ss/42?token=test'))
      .toBe('https://example.com:8443/live/user/p%40ss/42.m3u8?token=test')
    expect(getLiveHlsAlternative('http://example.com/live/user/pass/42.ts'))
      .toBe('http://example.com/live/user/pass/42.m3u8')
  })

  it('leaves arbitrary URLs, VOD, and existing HLS URLs unchanged', () => {
    for (const url of ['/relative.ts', 'invalid', 'https://example.com/news.ts',
      'https://example.com/movie/user/pass/42.ts', 'https://example.com/series/user/pass/42.ts',
      'https://example.com/live/user/pass/42.m3u8', 'https://example.com/path/to/channel.ts']) {
      expect(getLiveHlsAlternative(url)).toBeNull()
    }
  })
})

describe('HLS manifest probe', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

  it('rejects HTTP 405 without constructing or retrying an HLS player', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Not allowed', { status: 405 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(probeLiveHlsManifest('/candidate.m3u8', new AbortController().signal))
      .resolves.toEqual({ supported: false, status: 405 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('accepts HLS text with a BOM and rejects HTML even when HTTP succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('\uFEFF#EXTM3U\n#EXT-X-VERSION:3\n'))
      .mockResolvedValueOnce(new Response('<html>Unavailable</html>')))
    const signal = new AbortController().signal
    expect((await probeLiveHlsManifest('/candidate.m3u8', signal)).supported).toBe(true)
    expect((await probeLiveHlsManifest('/candidate.m3u8', signal)).supported).toBe(false)
  })

  it('aborts a pending probe after four seconds', async () => {
    vi.useFakeTimers()
    let requestSignal!: AbortSignal
    vi.stubGlobal('fetch', vi.fn((_url, config: RequestInit) => new Promise((_resolve, reject) => {
      requestSignal = config.signal as AbortSignal
      requestSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))
    const result = probeLiveHlsManifest('/candidate.m3u8', new AbortController().signal)
    await vi.advanceTimersByTimeAsync(4000)
    expect(requestSignal.aborted).toBe(true)
    await expect(result).resolves.toEqual({ supported: false })
  })

  it('cancels the request when the playback session is closed', async () => {
    const session = new AbortController()
    let requestSignal!: AbortSignal
    vi.stubGlobal('fetch', vi.fn((_url, config: RequestInit) => new Promise((_resolve, reject) => {
      requestSignal = config.signal as AbortSignal
      requestSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))
    const result = probeLiveHlsManifest('/candidate.m3u8', session.signal)
    session.abort()
    expect(requestSignal.aborted).toBe(true)
    await expect(result).resolves.toEqual({ supported: false })
  })
})
