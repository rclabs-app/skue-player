import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { monitorLivePlayback } from './livePlaybackMonitor'

describe('live playback diagnosis', () => {
  let stop: (() => void) | undefined
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { stop?.(); vi.useRealTimers() })

  function setup() {
    let frames = 100
    const video = {
      currentTime: 10, paused: false, seeking: false, ended: false,
      readyState: 2, networkState: 2,
      buffered: { length: 1, start: () => 0, end: () => 30 },
      getVideoPlaybackQuality: () => ({ totalVideoFrames: frames, droppedVideoFrames: 0 }),
    }
    const report = vi.fn()
    stop = monitorLivePlayback(video as unknown as HTMLVideoElement, {
      getNetworkSpeed: () => 120, report,
    })
    return { video, report, addFrames: () => { frames += 50 } }
  }

  it('reports a frozen clock even with buffered data and active network traffic', async () => {
    const { report } = setup()
    await vi.advanceTimersByTimeAsync(12000)
    expect(report).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'clock-stopped', currentTime: 10, buffered: [[0, 30]], speedKBps: 120,
    }))
    expect(JSON.stringify(report.mock.calls)).not.toContain('url')
  })

  it('distinguishes stopped frames from a moving clock', async () => {
    const { video, report } = setup()
    for (let i = 0; i < 4; i++) {
      video.currentTime += 2
      await vi.advanceTimersByTimeAsync(2000)
    }
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ reason: 'frames-stopped' }))
  })

  it('does not report manual pauses or healthy playback and cancels on teardown', async () => {
    const { video, report, addFrames } = setup()
    video.paused = true
    await vi.advanceTimersByTimeAsync(10000)
    video.paused = false
    for (let i = 0; i < 5; i++) {
      video.currentTime += 2
      addFrames()
      await vi.advanceTimersByTimeAsync(2000)
    }
    stop!()
    await vi.advanceTimersByTimeAsync(10000)
    expect(report).not.toHaveBeenCalled()
  })
})
