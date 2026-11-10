import type mpegts from 'mpegts.js'

/** A function-valued custom loader cannot be structured-cloned into a worker. */
export function createMpegtsConfig(isLive: boolean, liveLoader?: mpegts.CustomLoaderConstructor): mpegts.Config {
  return {
    enableWorker: !(isLive && liveLoader),
    customLoader: isLive ? liveLoader : undefined,
    enableStashBuffer: true,
    stashInitialSize: isLive ? 128 * 1024 : 1024,
    fixAudioTimestampGap: true,
    liveBufferLatencyChasing: isLive,
    liveBufferLatencyMaxLatency: 15,
    liveBufferLatencyMinRemain: 2,
    autoCleanupSourceBuffer: isLive,
    autoCleanupMaxBackwardDuration: 60,
    autoCleanupMinBackwardDuration: 30,
  }
}
