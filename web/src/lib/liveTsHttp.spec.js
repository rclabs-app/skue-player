import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { expect, it } from 'vitest'
import Controller from '../../node_modules/mpegts.js/src/core/transmuxing-controller.js'
import { createDefaultConfig } from '../../node_modules/mpegts.js/src/config.js'
import Events from '../../node_modules/mpegts.js/src/core/transmuxing-events.ts'
import { createMpegtsConfig } from './mpegtsConfig'
import { createLiveTsLoader } from './liveTsLoader'

// Optional system diagnostic: requires a loopback socket and FFmpeg.
// SKUE_HTTP_DIAGNOSTICS=1 npm test -- src/lib/liveTsHttp.spec.js
it.runIf(process.env.SKUE_HTTP_DIAGNOSTICS === '1')('recovers real HTTP EOFs over 33 seconds and decodes the resulting MP4 audio/video', async () => {
  const source = gunzipSync(readFileSync('src/lib/__fixtures__/live-av-30s.ts.gz'))
  const ranges = [[0, .4], [.25, .7], [.6, 1]]
  const tracks = { audio: [], video: [] }, times = { audio: [], video: [] }
  const timers = []
  let controller, requests = 0, connected = 0, peakConnections = 0
  const offset = ratio => Math.floor(source.length * ratio / 188) * 188
  let resolveEnded, rejectFailure
  const ended = new Promise((resolve, reject) => { resolveEnded = resolve; rejectFailure = reject })
  const server = createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': '*' })
      res.end(); return
    }
    connected++; peakConnections = Math.max(connected, peakConnections)
    res.on('close', () => connected--)
    const range = ranges[requests++]
    res.writeHead(200, { 'Content-Type': 'video/mp2t', 'Access-Control-Allow-Origin': '*' })
    res.flushHeaders()
    if (!range) return
    const bytes = source.subarray(offset(range[0]), offset(range[1]))
    const size = Math.ceil(bytes.length / 11)
    for (let i = 0; i < 11; i++) timers.push(setTimeout(() => res.write(bytes.subarray(i * size, (i + 1) * size)), i * 1000))
    timers.push(setTimeout(() => { res.end(); if (requests === 3) resolveEnded() }, 11000))
  })
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    const url = `http://127.0.0.1:${server.address().port}/synthetic.ts`
    const Loader = createLiveTsLoader({ isPaused: () => false, bufferedAhead: () => 0 })
    controller = new Controller({ type: 'mpegts', isLive: true, url }, { ...createDefaultConfig(), ...createMpegtsConfig(true, Loader), isLive: true })
    controller.on(Events.INIT_SEGMENT, (type, segment) => tracks[type].push(Buffer.from(segment.data)))
    controller.on(Events.MEDIA_SEGMENT, (type, segment) => {
      tracks[type].push(Buffer.from(segment.data))
      times[type].push([segment.info.beginDts, segment.info.endDts])
    })
    controller.on(Events.IO_ERROR, () => rejectFailure(new Error('Unexpected IO error')))
    controller.on(Events.DEMUX_ERROR, () => rejectFailure(new Error('Unexpected demux error')))
    let completed = false
    controller.on(Events.LOADING_COMPLETE, () => { completed = true })
    controller.start()
    await ended
    expect(requests).toBe(3)
    expect(peakConnections).toBe(1)
    expect(completed).toBe(false)
    for (const [type, pieces] of Object.entries(tracks)) {
      expect(times[type].at(-1)[1]).toBeGreaterThan(27000)
      for (let i = 1; i < times[type].length; i++) {
        expect(times[type][i][1]).toBeGreaterThan(times[type][i][0])
        expect(Math.abs(times[type][i][0] - times[type][i - 1][1])).toBeLessThan(100)
      }
      const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-f', 'null', '-'], { input: Buffer.concat(pieces), timeout: 10000 })
      expect(result.status, `${type}: ${result.stderr}`).toBe(0)
      expect(result.stderr.toString(), type).toBe('')
      console.info(`${type}: ${pieces.length - 1} fragments decoded across three finite HTTP responses`)
    }
  } finally {
    timers.forEach(clearTimeout)
    controller?.destroy()
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
}, 45000)
