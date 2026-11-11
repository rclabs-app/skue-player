import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import VideoPlayer from './VideoPlayer.vue'

const state = vi.hoisted(() => ({
  players: [] as Array<{
    destroy: ReturnType<typeof vi.fn>
    emitError: () => void
    emitComplete: () => void
    url: string
    config: import('mpegts.js').default.Config
  }>,
  savedProgress: null as null | { currentTime: number; duration: number },
  updateProgress: vi.fn(),
  native: false,
  hlsSupported: false,
  probeHls: vi.fn(),
  hlsInstances: [] as Array<{
    destroy: ReturnType<typeof vi.fn>
    loadSource: ReturnType<typeof vi.fn>
    emit: (name: string, data?: { fatal: boolean }) => void
  }>,
}))

vi.mock('../stores/history', () => ({
  useHistoryStore: () => ({ getProgress: () => state.savedProgress, updateProgress: state.updateProgress }),
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => state.native } }))
vi.mock('../lib/liveStreamUrl', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/liveStreamUrl')>()
  return { ...actual, probeLiveHlsManifest: (url: string, signal: AbortSignal) => state.probeHls(url, signal) }
})
vi.mock('hls.js', () => ({
  default: class {
    static isSupported() { return state.hlsSupported }
    static Events = { MANIFEST_PARSED: 'manifest', LEVEL_LOADED: 'level', ERROR: 'error' }
    callbacks = new Map<string, (event: string, data?: { fatal: boolean }) => void>()
    destroy = vi.fn()
    loadSource = vi.fn()
    attachMedia = vi.fn()
    constructor() { state.hlsInstances.push(this) }
    on(name: string, callback: (event: string, data?: { fatal: boolean }) => void) { this.callbacks.set(name, callback) }
    emit(name: string, data?: { fatal: boolean }) { this.callbacks.get(name)?.(name, data) }
  },
}))
vi.mock('mpegts.js', async importOriginal => ({
  default: {
    ...(await importOriginal<typeof import('mpegts.js')>()).default,
    isSupported: () => true,
    Events: { ERROR: 'error', LOADING_COMPLETE: 'loading_complete' },
    createPlayer: (source: { url: string }, config: import('mpegts.js').default.Config) => {
      let onError = () => {}
      let onComplete = () => {}
      const player = {
        attachMediaElement: vi.fn(), load: vi.fn(), destroy: vi.fn(),
        on: (name: string, callback: () => void) => {
          if (name === 'error') onError = callback
          if (name === 'loading_complete') onComplete = callback
        },
        statisticsInfo: { speed: 0 },
        emitError: () => onError(),
        emitComplete: () => onComplete(),
        url: source.url,
        config,
      }
      state.players.push(player)
      return player
    },
  },
}))

describe('VideoPlayer playback lifecycle', () => {
  let wrapper: VueWrapper | undefined
  let play: ReturnType<typeof vi.spyOn>

  function open(isLive = true, url = '/test-live.ts') {
    wrapper = mount(VideoPlayer, {
      props: { url, id: 'test', isLive },
      global: { stubs: { teleport: true } },
    })
    return wrapper
  }

  beforeEach(() => {
    vi.useFakeTimers()
    state.players.length = 0
    state.savedProgress = null
    state.native = false
    state.hlsSupported = false
    state.probeHls.mockReset().mockResolvedValue({ supported: true, status: 200 })
    state.hlsInstances.length = 0
    state.updateProgress.mockReset().mockResolvedValue(undefined)
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  it('resumes saved VOD progress without overwriting it with initial ticks', async () => {
    state.savedProgress = { currentTime: 300, duration: 1000 }
    open(false, '/movie/test.webm')
    const video = wrapper!.find('video')
    Object.defineProperty(video.element, 'duration', { configurable: true, value: 1000 })
    Object.defineProperty(video.element, 'readyState', { configurable: true, value: 1 })
    video.element.currentTime = 1
    await video.trigger('timeupdate')
    expect(state.updateProgress).not.toHaveBeenCalled()
    expect(video.element.currentTime).toBe(300)
    await video.trigger('seeked')
    video.element.currentTime = 310
    await video.trigger('timeupdate')
    expect(state.updateProgress).toHaveBeenCalledWith('test', 310, 1000)
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    Reflect.deleteProperty(window, 'NativePlayer')
  })

  it('selects continuous HTTP recovery for live playback without sending a function-valued loader to a worker', () => {
    open()
    expect(state.players[0]!.config.enableWorker).toBe(false)
    expect(state.players[0]!.config.customLoader).toBeTypeOf('function')
  })

  it('preserves the standard loader and worker for VOD', () => {
    open(false)
    expect(state.players[0]!.config.enableWorker).toBe(true)
    expect(state.players[0]!.config.customLoader).toBeUndefined()
  })

  it('handles a rejected play promise after pause/source abort without an unhandled rejection', async () => {
    const view = open()
    await vi.advanceTimersByTimeAsync(100)
    play.mockRejectedValueOnce(new DOMException('Fetching aborted', 'AbortError'))
    await view.get('video').trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(play).toHaveBeenCalledTimes(2)
    expect(view.text()).not.toContain('Não foi possível iniciar o vídeo')
  })

  it('cancels scheduled autoplay when the player is closed', async () => {
    open()
    wrapper!.unmount()
    wrapper = undefined
    await vi.advanceTimersByTimeAsync(200)
    expect(play).not.toHaveBeenCalled()
    expect(state.players[0].destroy).toHaveBeenCalledTimes(1)
  })

  it('releases the old source before saving progress can resolve and preserves the new player', async () => {
    const view = open(false)
    const video = view.get('video').element as HTMLVideoElement
    video.currentTime = 20
    await view.get('video').trigger('timeupdate')
    let finishSaving!: () => void
    state.updateProgress.mockImplementation(() => new Promise<void>(resolve => { finishSaving = resolve }))
    await view.setProps({ url: '/next-live.ts' })
    expect(state.players[0].destroy).toHaveBeenCalledTimes(1)
    expect(state.players).toHaveLength(2)
    finishSaving()
    await vi.advanceTimersByTimeAsync(100)
    expect(state.players[1].destroy).not.toHaveBeenCalled()
  })

  it('ignores error callbacks from a player replaced by a different channel', async () => {
    const view = open()
    const oldPlayer = state.players[0]
    await view.setProps({ url: '/next-live.ts' })
    oldPlayer.emitError()
    expect(state.players[1].destroy).not.toHaveBeenCalled()
    expect(view.text()).not.toContain('Erro de Reprodução')
  })

  it('shows actionable errors for play failures other than an expected abort', async () => {
    const view = open()
    await vi.advanceTimersByTimeAsync(100)
    play.mockRejectedValueOnce(new DOMException('Unsupported', 'NotSupportedError'))
    await view.get('video').trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(view.text()).toContain('Não foi possível iniciar o vídeo')
  })

  it('keeps an ended browser live channel open with a retry action', async () => {
    const view = open()
    await view.get('video').trigger('ended')
    expect(view.emitted('close')).toBeUndefined()
    expect(view.text()).toContain('Transmissão interrompida')
    const retry = view.findAll('button').find(button => button.text().includes('Tentar Novamente'))!
    await retry.trigger('click')
    expect(state.players).toHaveLength(2)
    expect(view.text()).not.toContain('Transmissão interrompida')
  })

  it('keeps an ended native live channel open instead of returning to the list', async () => {
    state.native = true
    Reflect.set(window, 'NativePlayer', { playNativeVideo: vi.fn(), stopNativeVideo: vi.fn() })
    const view = open()
    Reflect.get(window, 'onNativePlayerEnded')()
    await view.vm.$nextTick()
    expect(view.emitted('close')).toBeUndefined()
    expect(view.text()).toContain('Transmissão interrompida')
  })

  it('preserves native VOD close behavior on completion', async () => {
    state.native = true
    Reflect.set(window, 'NativePlayer', { playNativeVideo: vi.fn(), stopNativeVideo: vi.fn() })
    const view = open(false)
    Reflect.get(window, 'onNativePlayerEnded')()
    await view.vm.$nextTick()
    expect(view.emitted('close')).toHaveLength(1)
  })
  it('switches a finite live TS response to HLS on the same server without closing or showing the ended error', async () => {
    state.hlsSupported = true
    const view = open(true, 'https://example.com/user/pass/42')
    state.players[0].emitComplete()
    await view.get('video').trigger('ended')
    await vi.advanceTimersByTimeAsync(0)
    expect(state.players[0].destroy).toHaveBeenCalledTimes(1)
    expect(state.hlsInstances[0].loadSource).toHaveBeenCalledWith('https://example.com/live/user/pass/42.m3u8')
    state.hlsInstances[0].emit('manifest')
    state.hlsInstances[0].emit('level')
    state.hlsInstances[0].emit('level')
    await view.vm.$nextTick()
    expect(view.emitted('close')).toBeUndefined()
    expect(view.text()).not.toContain('Transmissão interrompida')
    expect(state.players).toHaveLength(1)
  })

  it('falls back to the original TS source when HLS is unavailable, without repeatedly trying HLS', async () => {
    state.hlsSupported = true
    const view = open(true, 'https://example.com/user/pass/42')
    state.players[0].emitComplete()
    await vi.advanceTimersByTimeAsync(0)
    state.hlsInstances[0].emit('error', { fatal: true })
    expect(state.players[1].url).toBe('https://example.com/user/pass/42')
    state.players[1].emitComplete()
    await view.get('video').trigger('ended')
    await vi.advanceTimersByTimeAsync(250)
    expect(state.players).toHaveLength(3)
    expect(state.hlsInstances).toHaveLength(1)
    expect(view.text()).not.toContain('Transmissão interrompida')
  })

  it('reopens an arbitrary finite live source with a new player after the buffer ends', async () => {
    const view = open()
    state.players[0].emitComplete()
    expect(state.players[0].destroy).not.toHaveBeenCalled()
    await view.get('video').trigger('ended')
    await vi.advanceTimersByTimeAsync(250)
    expect(state.players[0].destroy).toHaveBeenCalledTimes(1)
    expect(state.players[1].url).toBe('/test-live.ts')
    expect(view.emitted('close')).toBeUndefined()
    expect(view.text()).not.toContain('Transmissão interrompida')
  })

  it('stops reconnecting after repeated endings without usable playback', async () => {
    const view = open()
    for (let i = 0; i < 4; i++) {
      state.players.at(-1)!.emitComplete()
      await view.get('video').trigger('ended')
      await vi.advanceTimersByTimeAsync(1000)
    }
    expect(state.players).toHaveLength(4)
    expect(view.text()).toContain('A reconexão automática foi interrompida')
  })

  it('cancels reconnection when the live player is closed', async () => {
    const view = open()
    state.players[0].emitComplete()
    await view.get('video').trigger('ended')
    wrapper!.unmount()
    wrapper = undefined
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.players).toHaveLength(1)
  })

  it('does not reconnect completed VOD or probe an HLS alternative', async () => {
    state.hlsSupported = true
    const view = open(false)
    state.players[0].emitComplete()
    await view.get('video').trigger('ended')
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.players).toHaveLength(1)
    expect(state.hlsInstances).toHaveLength(0)
  })

  it('keeps a manually paused stream paused when switching from TS to HLS', async () => {
    state.hlsSupported = true
    const view = open(true, 'https://example.com/user/pass/42')
    Object.defineProperty(view.get('video').element, 'paused', { configurable: true, value: false })
    await view.get('video').trigger('click')
    state.players[0].emitComplete()
    await vi.advanceTimersByTimeAsync(0)
    play.mockClear()
    state.hlsInstances[0].emit('manifest')
    await vi.advanceTimersByTimeAsync(100)
    expect(play).not.toHaveBeenCalled()
    expect(view.get('video').element.autoplay).toBe(false)
  })

  it('stops the loading loop even when every short response plays for more than three seconds', async () => {
    const view = open()
    for (let i = 0; i < 4; i++) {
      (view.get('video').element as HTMLVideoElement).currentTime = 10
      state.players.at(-1)!.emitComplete()
      await view.get('video').trigger('ended')
      await vi.advanceTimersByTimeAsync(1000)
    }
    expect(state.players).toHaveLength(4)
    expect(view.text()).toContain('Conexão instável')
    await vi.advanceTimersByTimeAsync(120000)
    expect(state.players).toHaveLength(4)
  })

  it('allows a fresh retry when previous reconnections are outside the one-minute window', async () => {
    const view = open()
    for (let i = 0; i < 3; i++) {
      state.players.at(-1)!.emitComplete()
      await view.get('video').trigger('ended')
      await vi.advanceTimersByTimeAsync(1000)
    }
    await vi.advanceTimersByTimeAsync(61000)
    state.players.at(-1)!.emitComplete()
    await view.get('video').trigger('ended')
    await vi.advanceTimersByTimeAsync(250)
    expect(state.players).toHaveLength(5)
    expect(view.text()).not.toContain('Conexão instável')
  })

  it('allows an explicit user retry after automatic reconnection is stopped', async () => {
    const view = open()
    for (let i = 0; i < 4; i++) {
      state.players.at(-1)!.emitComplete()
      await view.get('video').trigger('ended')
      await vi.advanceTimersByTimeAsync(1000)
    }
    const retry = view.findAll('button').find(button => button.text().includes('Tentar Novamente'))!
    await retry.trigger('click')
    expect(state.players).toHaveLength(5)
    state.players.at(-1)!.emitComplete()
    await view.get('video').trigger('ended')
    await vi.advanceTimersByTimeAsync(250)
    expect(state.players).toHaveLength(6)
    expect(view.text()).not.toContain('Conexão instável')
  })

  it('cancels the old reconnect when the user selects another channel', async () => {
    const view = open()
    state.players[0].emitComplete()
    await view.get('video').trigger('ended')
    await view.setProps({ url: '/another-live.ts' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.players).toHaveLength(2)
    expect(state.players[1].url).toBe('/another-live.ts')
  })

  it('waits for manual play before reopening a paused stream whose HTTP response has ended', async () => {
    const view = open()
    const video = view.get('video').element
    Object.defineProperty(video, 'paused', { configurable: true, value: false })
    await view.get('video').trigger('click')
    state.players[0].emitComplete()
    await view.get('video').trigger('ended')
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.players).toHaveLength(1)
    Object.defineProperty(video, 'paused', { configurable: true, value: true })
    await view.get('video').trigger('click')
    await vi.advanceTimersByTimeAsync(250)
    expect(state.players).toHaveLength(2)
    expect(view.text()).not.toContain('Transmissão interrompida')
  })

  it('keeps the original TS buffer when the HLS candidate responds 405, then reconnects TS at the end', async () => {
    state.hlsSupported = true
    state.probeHls.mockResolvedValueOnce({ supported: false, status: 405 })
    const view = open(true, 'https://example.com/user/pass/42')
    state.players[0].emitComplete()
    await vi.advanceTimersByTimeAsync(0)
    expect(state.hlsInstances).toHaveLength(0)
    expect(state.players[0].destroy).not.toHaveBeenCalled()
    await view.get('video').trigger('ended')
    await vi.advanceTimersByTimeAsync(250)
    expect(state.players[1].url).toBe('https://example.com/user/pass/42')
    expect(state.probeHls).toHaveBeenCalledTimes(1)
    state.players[1].emitComplete()
    await vi.advanceTimersByTimeAsync(0)
    expect(state.probeHls).toHaveBeenCalledTimes(1)
    expect(view.text()).not.toContain('Transmissão interrompida')
  })

  it('reconnects after a rejected HLS probe even if the old buffer ended while waiting', async () => {
    state.hlsSupported = true
    let finishProbe!: (value: { supported: boolean; status: number }) => void
    state.probeHls.mockImplementationOnce(() => new Promise(resolve => { finishProbe = resolve }))
    const view = open(true, 'https://example.com/user/pass/42')
    state.players[0].emitComplete()
    await vi.advanceTimersByTimeAsync(0)
    await view.get('video').trigger('ended')
    finishProbe({ supported: false, status: 405 })
    await vi.advanceTimersByTimeAsync(250)
    expect(state.players).toHaveLength(2)
    expect(state.hlsInstances).toHaveLength(0)
    expect(view.text()).not.toContain('Transmissão interrompida')
  })

  it('cancels an outstanding HLS probe when the user closes the player', async () => {
    state.hlsSupported = true
    let finishProbe!: (value: { supported: boolean }) => void
    state.probeHls.mockImplementationOnce(() => new Promise(resolve => { finishProbe = resolve }))
    open(true, 'https://example.com/user/pass/42')
    state.players[0].emitComplete()
    await vi.advanceTimersByTimeAsync(0)
    const signal = state.probeHls.mock.calls[0][1] as AbortSignal
    wrapper!.unmount()
    wrapper = undefined
    expect(signal.aborted).toBe(true)
    finishProbe({ supported: true })
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.hlsInstances).toHaveLength(0)
    expect(state.players).toHaveLength(1)
  })

})
