import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLiveTsLoader } from './liveTsLoader'
import { createMpegtsConfig } from './mpegtsConfig'

const source = gunzipSync(readFileSync('src/lib/__fixtures__/live-av-30s.ts.gz'))
describe('live HTTP recovery', () => {
  let loader, paused = false, buffer = 0
  function open(options = {}) {
    const Loader = createLiveTsLoader({ isPaused: () => paused, bufferedAhead: () => buffer, ...options })
    loader = new Loader({}, {})
    loader.onDataArrival = vi.fn()
    loader.onError = vi.fn()
    loader.onComplete = vi.fn()
    loader.open({ url: '/live-test.ts' }, { from: 0, to: -1 })
    return loader
  }
  beforeEach(() => { vi.useFakeTimers(); paused = false; buffer = 0 })
  afterEach(() => { loader?.destroy(); vi.useRealTimers(); vi.unstubAllGlobals() })

  it('bounds recovery when only transport tables arrive without any audio/video PES', async () => {
    const fetch = vi.fn(async () => new Response(source.subarray(0, 188 * 3)))
    vi.stubGlobal('fetch', fetch)
    open()
    await vi.advanceTimersByTimeAsync(30000)
    expect(fetch).toHaveBeenCalledTimes(8)
    expect(loader.onError).toHaveBeenCalledTimes(1)
    expect(loader.onComplete).not.toHaveBeenCalled()
  })
  it('does not replay the same media indefinitely or send backwards timestamps when a clock resets', async () => {
    const fetch = vi.fn(async () => new Response(source))
    vi.stubGlobal('fetch', fetch)
    open()
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetch).toHaveBeenCalledTimes(4) // first response advances, next three do not
    expect(loader.onError).toHaveBeenCalledTimes(1)
    expect(loader.onComplete).not.toHaveBeenCalled()
    for (const call of fetch.mock.calls) expect(call[1].headers?.Range).toBeUndefined()
  })
  it('treats HTTP 403 as terminal instead of retrying an authorization failure', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 403 }))
    vi.stubGlobal('fetch', fetch)
    open()
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(loader.onError.mock.calls[0][1]).toEqual({ code: 403, msg: 'Live HTTP request rejected' })
  })
  it('recovers through a 503, empty response and network error without prematurely ending playback', async () => {
    const diagnostics = []
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(new Uint8Array(0)))
      .mockRejectedValueOnce(new Error('private address must never appear in diagnostics'))
      .mockResolvedValueOnce(new Response(new ReadableStream({ start(stream) { stream.enqueue(source) } })))
    vi.stubGlobal('fetch', fetch)
    open({ onRecovery: diagnostic => diagnostics.push(diagnostic) })
    await vi.advanceTimersByTimeAsync(7500)
    expect(fetch).toHaveBeenCalledTimes(4)
    expect(loader.onDataArrival).toHaveBeenCalled()
    expect(loader.onError).not.toHaveBeenCalled()
    expect(loader.onComplete).not.toHaveBeenCalled()
    expect(diagnostics.map(item => item.reason)).toEqual(['http-status', 'empty-response', 'transport-error'])
    expect(diagnostics.every(item => item.retrying)).toBe(true)
    expect(JSON.stringify(diagnostics)).not.toContain('private address')
  })
  it('bounds empty-response recovery by time and attempts instead of a rapid retry loop', async () => {
    const diagnostics = []
    const fetch = vi.fn(async () => new Response(new Uint8Array(0)))
    vi.stubGlobal('fetch', fetch)
    open({ onRecovery: diagnostic => diagnostics.push(diagnostic) })
    await vi.advanceTimersByTimeAsync(30000)
    expect(fetch).toHaveBeenCalledTimes(8)
    expect(loader.onError).toHaveBeenCalledTimes(1)
    expect(diagnostics.at(-1)).toMatchObject({ reason: 'empty-response', retrying: false, receivedBytes: 0 })
    expect(diagnostics.at(-1).elapsedMs).toBeLessThanOrEqual(30000)
  })
  it('does not consume the recovery budget during a long manual pause', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(new Uint8Array(0)))
      .mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }))
    vi.stubGlobal('fetch', fetch)
    open()
    await vi.advanceTimersByTimeAsync(0)
    paused = true
    await vi.advanceTimersByTimeAsync(60000)
    expect(fetch).toHaveBeenCalledTimes(1)
    paused = false
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(loader.onError).not.toHaveBeenCalled()
  })
  it('cancels a scheduled reconnect on destroy', async () => {
    const fetch = vi.fn(async () => new Response(source))
    vi.stubGlobal('fetch', fetch)
    open()
    await vi.advanceTimersByTimeAsync(0)
    const onError = loader.onError
    loader.destroy()
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })
  it('aborts a hung response and bounds retries without leaking its URL into errors', async () => {
    const signals = []
    vi.stubGlobal('fetch', vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signals.push(signal)
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))
    open()
    await vi.advanceTimersByTimeAsync(32000)
    expect(signals).toHaveLength(3)
    expect(signals.every(signal => signal.aborted)).toBe(true)
    expect(loader.onError).toHaveBeenCalledTimes(1)
  })
  it('aborts a pending connection on pause and resumes without reporting completion', async () => {
    const signals = []
    const fetch = vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signals.push(signal)
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    vi.stubGlobal('fetch', fetch)
    open()
    paused = true
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(signals[0].aborted).toBe(true)
    paused = false
    await vi.advanceTimersByTimeAsync(250)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(loader.onError).not.toHaveBeenCalled()
    expect(loader.onComplete).not.toHaveBeenCalled()
  })
  it('bounds retries when packets keep arriving but their media clock does not advance', async () => {
    const fetch = vi.fn(async (_url, { signal }) => new Response(new ReadableStream({
      start(stream) {
        const timer = setInterval(() => stream.enqueue(source.subarray(0, 188)), 1000)
        signal.addEventListener('abort', () => {
          clearInterval(timer)
          stream.error(new DOMException('Aborted', 'AbortError'))
        }, { once: true })
      },
    })))
    vi.stubGlobal('fetch', fetch)
    open()
    await vi.advanceTimersByTimeAsync(32000)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(loader.onError).toHaveBeenCalledTimes(1)
  })
  it('waits for buffered media to be consumed before opening another response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(source)))
    buffer = 20
    open()
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetch).not.toHaveBeenCalled()
    buffer = 10
    await vi.advanceTimersByTimeAsync(200)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('keeps the custom loader on the main thread and preserves the VOD worker', () => {
    const Loader = createLiveTsLoader({ isPaused: () => false, bufferedAhead: () => 0 })
    expect(createMpegtsConfig(true, Loader)).toMatchObject({ customLoader: Loader, enableWorker: false })
    expect(createMpegtsConfig(false)).toMatchObject({ customLoader: undefined, enableWorker: true })
  })
})
