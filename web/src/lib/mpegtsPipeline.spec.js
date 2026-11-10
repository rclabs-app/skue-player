import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Controller from '../../node_modules/mpegts.js/src/core/transmuxing-controller.js'
import { createDefaultConfig } from '../../node_modules/mpegts.js/src/config.js'
import Events from '../../node_modules/mpegts.js/src/core/transmuxing-events.ts'
import { createMpegtsConfig } from './mpegtsConfig'

// Real MPEG-TS with H.264 (B frames) and AAC; no stream credentials or third-party media.
const source = gunzipSync(readFileSync('src/lib/__fixtures__/live-av-30s.ts.gz'))
const third = Math.floor(source.length / 188 / 3) * 188

describe('standard MPEG-TS pipeline', () => {
  let controller

  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    controller?.destroy()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('processes 30 seconds of real audio and video across incremental network reads without replacing timestamps', async () => {
    const fetchMock = vi.fn(async () => new Response(new ReadableStream({
      start(stream) {
        const send = (from, to) => {
          for (let offset = from; offset < to; offset += 188 * 40) {
            stream.enqueue(new Uint8Array(source.slice(offset, Math.min(offset + 188 * 40, to))))
          }
        }
        send(0, third)
        setTimeout(() => send(third, 2 * third), 100)
        setTimeout(() => { send(2 * third, source.length); stream.close() }, 200)
      },
    })))
    vi.stubGlobal('fetch', fetchMock)
    controller = new Controller({ type: 'mpegts', isLive: true, url: '/synthetic.ts' }, {
      ...createDefaultConfig(), ...createMpegtsConfig(true), isLive: true,
    })
    const ranges = { audio: [], video: [] }
    const complete = vi.fn()
    const ioError = vi.fn()
    controller.on(Events.MEDIA_SEGMENT, (type, segment) => {
      ranges[type].push([segment.info.beginDts, segment.info.endDts])
    })
    controller.on(Events.LOADING_COMPLETE, complete)
    controller.on(Events.IO_ERROR, ioError)
    controller.on(Events.DEMUX_ERROR, ioError)
    controller.start()
    await vi.advanceTimersByTimeAsync(150)
    const before = ranges.video.at(-1)[1]
    expect(before).toBeGreaterThan(10000)
    expect(complete).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    for (const segments of Object.values(ranges)) {
      expect(segments.at(-1)[1]).toBeGreaterThan(29000)
      for (let i = 0; i < segments.length; i++) {
        expect(segments[i][1]).toBeGreaterThan(segments[i][0])
        if (i) expect(Math.abs(segments[i][0] - segments[i - 1][1])).toBeLessThan(100)
      }
    }
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(complete).toHaveBeenCalledTimes(1)
    expect(ioError).not.toHaveBeenCalled()
  })
})

describe('continuous live HTTP pipeline', () => {
  let controller
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { controller?.destroy(); vi.useRealTimers(); vi.unstubAllGlobals() })
  it('keeps one transmuxer across overlapping finite responses without backwards DTS or duplicated audio/video', async () => {
    const { createLiveTsLoader } = await import('./liveTsLoader')
    const packetOffset = ratio => Math.floor(source.length * ratio / 188) * 188
    const responses = [[0, .4], [.25, .7], [.6, 1]]
    let request = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      const range = responses[request++]
      if (!range) return new Response(new ReadableStream({ start() {} }))
      return new Response(new ReadableStream({ start(stream) {
        const start = packetOffset(range[0]), end = packetOffset(range[1])
        for (let offset = start; offset < end; offset += 7193) {
          stream.enqueue(new Uint8Array(source.slice(offset, Math.min(offset + 7193, end))))
        }
        stream.close()
      } }))
    }))
    const loader = createLiveTsLoader({ isPaused: () => false, bufferedAhead: () => 0 })
    controller = new Controller({ type: 'mpegts', isLive: true, url: '/synthetic.ts' }, {
      ...createDefaultConfig(), ...createMpegtsConfig(true, loader), isLive: true,
    })
    const ranges = { audio: [], video: [] }
    const complete = vi.fn(), error = vi.fn()
    controller.on(Events.MEDIA_SEGMENT, (type, segment) => ranges[type].push([segment.info.beginDts, segment.info.endDts]))
    controller.on(Events.LOADING_COMPLETE, complete)
    controller.on(Events.IO_ERROR, error)
    controller.on(Events.DEMUX_ERROR, error)
    controller.start()
    await vi.advanceTimersByTimeAsync(500)
    for (const [type, track] of Object.entries(ranges)) {
      // IO stash retains the tail until more bytes arrive; it must still cross both reconnects.
      expect(track.at(-1)[1], type).toBeGreaterThan(27000)
      for (let i = 0; i < track.length; i++) {
        expect(track[i][1], `${type} segment ${i}`).toBeGreaterThan(track[i][0])
        if (i) expect(Math.abs(track[i][0] - track[i - 1][1]), `${type} gap ${i}`).toBeLessThan(100)
      }
    }
    expect(request).toBe(4)
    expect(complete).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })
})

describe('long-running live recovery', () => {
  let controller
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { controller?.destroy(); vi.useRealTimers(); vi.unstubAllGlobals() })
  it('passes six virtual minutes of audio/video and a transient outage after five minutes without recreating the pipeline', async () => {
    const { createLiveTsLoader } = await import('./liveTsLoader')
    const { shiftTsClock } = await import('./__fixtures__/shiftTsClock')
    let mediaResponse = 0, interruptions = 0
    const diagnostics = [], ranges = { audio: [], video: [] }
    const fetch = vi.fn(async () => {
      if (mediaResponse === 11 && interruptions < 3) {
        interruptions++
        if (interruptions === 1) return new Response('', { status: 503 })
        if (interruptions === 2) return new Response(new Uint8Array(0))
        throw new Error('temporary connection failure')
      }
      if (mediaResponse >= 12) return new Response(new ReadableStream({ start() {} }))
      const bytes = shiftTsClock(source, mediaResponse++ * 30)
      const size = Math.ceil(bytes.length / 30)
      return new Response(new ReadableStream({ start(stream) {
        for (let i = 0; i < 30; i++) setTimeout(() => stream.enqueue(bytes.slice(i * size, (i + 1) * size)), i * 1000)
        setTimeout(() => stream.close(), 30000)
      } }))
    })
    vi.stubGlobal('fetch', fetch)
    const Loader = createLiveTsLoader({ isPaused: () => false, bufferedAhead: () => 0, onRecovery: item => diagnostics.push(item) })
    controller = new Controller({ type: 'mpegts', isLive: true, url: '/long-synthetic.ts' }, {
      ...createDefaultConfig(), ...createMpegtsConfig(true, Loader), isLive: true,
    })
    const complete = vi.fn(), error = vi.fn()
    controller.on(Events.MEDIA_SEGMENT, (type, segment) => ranges[type].push([segment.info.beginDts, segment.info.endDts]))
    controller.on(Events.LOADING_COMPLETE, complete)
    controller.on(Events.IO_ERROR, error)
    controller.on(Events.DEMUX_ERROR, error)
    controller.start()
    await vi.advanceTimersByTimeAsync(370000)
    expect(mediaResponse).toBe(12)
    expect(interruptions).toBe(3)
    expect(diagnostics.filter(item => item.retrying && !item.acceptedPes).map(item => item.reason))
      .toEqual(['http-status', 'empty-response', 'transport-error'])
    for (const [type, track] of Object.entries(ranges)) {
      expect(track.at(-1)[1], type).toBeGreaterThan(357000)
      for (let i = 1; i < track.length; i++) {
        expect(track[i][1], type).toBeGreaterThan(track[i][0])
        expect(Math.abs(track[i][0] - track[i - 1][1]), `${type} gap ${i}`).toBeLessThan(100)
      }
    }
    expect(complete).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  }, 15000)
})
