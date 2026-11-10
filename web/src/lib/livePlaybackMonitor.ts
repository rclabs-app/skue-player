interface MonitorOptions {
  getNetworkSpeed: () => number | undefined
  report: (snapshot: LivePlaybackSnapshot) => void
}

export interface LivePlaybackSnapshot {
  currentTime: number
  readyState: number
  networkState: number
  ended: boolean
  buffered: Array<[number, number]>
  decodedFrames: number | null
  droppedFrames: number | null
  speedKBps: number | null
  reason: 'clock-stopped' | 'frames-stopped'
}

/** Diagnose playback separately from HTTP loading, without logging stream URLs. */
export function monitorLivePlayback(video: HTMLVideoElement, options: MonitorOptions): () => void {
  let previousTime = video.currentTime
  let previousFrames: number | null = null
  let clockStalls = 0
  let frameStalls = 0
  let reported = false
  const timer = setInterval(() => {
    const quality = video.getVideoPlaybackQuality?.()
    const frames = quality?.totalVideoFrames ?? null
    if (video.paused || video.seeking) {
      clockStalls = frameStalls = 0
      reported = false
    } else {
      clockStalls = Math.abs(video.currentTime - previousTime) < 0.05 ? clockStalls + 1 : 0
      frameStalls = frames !== null && frames === previousFrames ? frameStalls + 1 : 0
      if (clockStalls === 0 && frameStalls === 0) reported = false
      if (!reported && (clockStalls >= 3 || frameStalls >= 3)) {
        const buffered: Array<[number, number]> = []
        for (let i = 0; i < video.buffered.length; i++) buffered.push([video.buffered.start(i), video.buffered.end(i)])
        options.report({
          currentTime: video.currentTime, readyState: video.readyState, networkState: video.networkState,
          ended: video.ended, buffered, decodedFrames: frames,
          droppedFrames: quality?.droppedVideoFrames ?? null,
          speedKBps: options.getNetworkSpeed() ?? null,
          reason: clockStalls >= 3 ? 'clock-stopped' : 'frames-stopped',
        })
        reported = true
      }
    }
    previousTime = video.currentTime
    previousFrames = frames
  }, 2000)
  return () => clearInterval(timer)
}
