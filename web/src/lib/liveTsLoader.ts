import mpegts from 'mpegts.js'
import { LiveTsContinuity } from './liveTsContinuity'

interface Options {
  isPaused: () => boolean
  bufferedAhead: () => number
  onReconnect?: (attempt: number) => void
  onRecovery?: (diagnostic: LiveRecoveryDiagnostic) => void
}

export interface LiveRecoveryDiagnostic {
  reason: 'eof' | 'empty-response' | 'transport-error' | 'http-status' | 'invalid-ts' | 'no-data-timeout' | 'no-progress-timeout' | 'repeated-media' | 'backward-clock' | 'no-media'
  status?: number
  receivedBytes: number
  acceptedPes: number
  rejectedPes: number
  backwardClockPes: number
  attempt: number
  elapsedMs: number
  retrying: boolean
}

function isTransientRecovery(reason: LiveRecoveryDiagnostic['reason'], receivedBytes: number, rejectedPes: number): boolean {
  return receivedBytes === 0 || reason === 'no-media'
    || (reason === 'no-progress-timeout' && rejectedPes === 0)
}

/** Recover finite live responses through the public customLoader API. */
export function createLiveTsLoader(options: Options): mpegts.CustomLoaderConstructor {
  return class LiveTsLoader extends mpegts.BaseLoader {
    private controller: AbortController | null = null
    private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
    private stopped = false
    private generation = 0
    private bytes = 0
    private delay: ReturnType<typeof setTimeout> | null = null
    private wake: (() => void) | null = null
    private continuity = new LiveTsContinuity()
    constructor(_seekHandler: mpegts.SeekHandler, private config: mpegts.Config) {
      super('skue-live-ts-loader')
      this._needStash = true
    }
    override open(source: mpegts.MediaSegment, range: mpegts.Range): void {
      this.abort()
      this.stopped = false
      this.bytes = 0
      this.continuity = new LiveTsContinuity()
      const generation = ++this.generation
      this._status = mpegts.LoaderStatus.kConnecting
      if (range.from !== 0) { this.fail('Live streams cannot be byte-seeked'); return }
      void this.run(source, generation)
    }
    override abort(): void {
      this.stopped = true
      this.generation++
      this.controller?.abort()
      void this.reader?.cancel().catch(() => {})
      if (this.delay) clearTimeout(this.delay)
      this.wake?.()
      this.delay = null
      this.wake = null
      this._status = mpegts.LoaderStatus.kIdle
    }
    override destroy(): void { this.abort(); super.destroy() }
    private active(generation: number): boolean { return !this.stopped && generation === this.generation }
    private wait(ms: number): Promise<void> {
      return new Promise(resolve => {
        this.wake = resolve
        this.delay = setTimeout(() => { this.wake = null; this.delay = null; resolve() }, ms)
      })
    }
    private fail(message: string, code = -1): void {
      this._status = mpegts.LoaderStatus.kError
      // Upstream types incorrectly describe the callback's string enum as an object.
      this.onError?.(mpegts.LoaderErrors.EXCEPTION as unknown as mpegts.LoaderErrors, { code, msg: message })
    }
    private async run(source: mpegts.MediaSegment, generation: number): Promise<void> {
      let failures = 0
      let recoveryStarted: number | null = null
      while (this.active(generation)) {
        // Do not fetch the next response while paused or build unbounded live latency.
        while (this.active(generation) && (options.isPaused() || options.bufferedAhead() > 15)) {
          // A manual pause must not spend the network recovery budget.
          if (options.isPaused()) { recoveryStarted = null; failures = 0 }
          await this.wait(200)
        }
        if (!this.active(generation)) return
        const progress = this.continuity.progress
        const rejected = this.continuity.rejectedPes
        const backward = this.continuity.backwardClockPes
        const requestStarted = Date.now()
        let receivedBytes = 0, status: number | undefined
        let reason: LiveRecoveryDiagnostic['reason'] = 'transport-error'
        let lastRead = Date.now(), lastAdvance = Date.now(), paused = false
        const controller = new AbortController()
        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
        this.controller = controller
        const watchdog = setInterval(() => {
          paused = options.isPaused()
          const noData = Date.now() - lastRead >= 10000
          const noProgress = Date.now() - lastAdvance >= 10000
          const budgetExpired = recoveryStarted !== null && Date.now() - recoveryStarted >= 30000
          if (noData) reason = 'no-data-timeout'
          else if (noProgress) reason = 'no-progress-timeout'
          if (paused || noData || noProgress || budgetExpired) controller.abort()
        }, 200)
        let terminal = false, terminalCode = -1
        try {
          const response = await fetch(source.url, {
            signal: controller.signal, cache: 'no-store',
            headers: this.config.headers,
            credentials: (source as mpegts.MediaDataSource).withCredentials ? 'include' : 'same-origin',
          })
          if (!this.active(generation)) { await response.body?.cancel(); return }
          status = response.status
          if (!response.ok || !response.body) {
            reason = 'http-status'
            terminalCode = response.status
            terminal = response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429
            await response.body?.cancel()
            throw new Error('Live HTTP request failed')
          }
          reader = response.body.getReader()
          this.reader = reader
          this._status = mpegts.LoaderStatus.kBuffering
          while (this.active(generation)) {
            const { value, done } = await reader.read()
            if (!this.active(generation)) return
            if (done) { reason = 'eof'; break }
            lastRead = Date.now()
            receivedBytes += value.byteLength
            const previousProgress = this.continuity.progress
            let chunk: Uint8Array
            try { chunk = this.continuity.push(value) }
            catch { reason = 'invalid-ts'; throw new Error('Invalid live TS data') }
            if (this.continuity.progress > previousProgress) {
              lastAdvance = Date.now()
              recoveryStarted = null
            }
            if (chunk.length) {
              const start = this.bytes
              this.bytes += chunk.byteLength
              this.onDataArrival?.(chunk.buffer as ArrayBuffer, start, this.bytes)
            }
          }
        } catch {
          // Errors are bounded below, with no credential-containing exception text.
        } finally {
          clearInterval(watchdog)
          controller.abort()
          await reader?.cancel().catch(() => {})
          if (this.reader === reader) this.reader = null
          if (this.active(generation)) this.continuity.endResponse()
        }
        if (!this.active(generation)) return
        if (paused) continue
        const acceptedPes = this.continuity.progress - progress
        const rejectedPes = this.continuity.rejectedPes - rejected
        const backwardClockPes = this.continuity.backwardClockPes - backward
        if (!acceptedPes && reason === 'eof') {
          reason = backwardClockPes ? 'backward-clock' : rejectedPes ? 'repeated-media' : receivedBytes ? 'no-media' : 'empty-response'
        }
        failures = acceptedPes ? 0 : failures + 1
        if (acceptedPes) recoveryStarted = null
        else recoveryStarted ??= requestStarted
        const elapsedMs = recoveryStarted === null ? 0 : Date.now() - recoveryStarted
        const transient = isTransientRecovery(reason, receivedBytes, rejectedPes)
        const exhausted = !acceptedPes && (transient ? failures >= 8 || elapsedMs >= 30000 : failures >= 3)
        options.onRecovery?.({ reason, status, receivedBytes, acceptedPes, rejectedPes, backwardClockPes,
          attempt: failures, elapsedMs, retrying: !terminal && !exhausted })
        if (!this.active(generation)) return
        if (terminal) { this.fail('Live HTTP request rejected', terminalCode); return }
        if (exhausted) {
          this.fail(transient ? 'Live transport recovery exhausted' : 'Live stream stopped advancing after three requests')
          return
        }
        options.onReconnect?.(failures + 1)
        if (!this.active(generation)) return
        // Never report onComplete for an individual live HTTP response.
        this._status = mpegts.LoaderStatus.kConnecting
        const delay = failures ? (transient ? Math.min(1000 * 2 ** (failures - 1), 5000, 30000 - elapsedMs) : Math.min(250 * 2 ** (failures - 1), 1000)) : 100
        await this.wait(delay)
      }
    }
  }
}
