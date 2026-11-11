<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, type CSSProperties } from 'vue'
import Hls from 'hls.js'
import mpegts from 'mpegts.js'
import { monitorLivePlayback } from '../lib/livePlaybackMonitor'
import { createMpegtsConfig } from '../lib/mpegtsConfig'
import { createLiveTsLoader } from '../lib/liveTsLoader'
import { getLiveHlsAlternative, probeLiveHlsManifest } from '../lib/liveStreamUrl'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { useHistoryStore } from '../stores/history'
import PlayerTopBar from './PlayerTopBar.vue'
import PlayerActionCenter from './PlayerActionCenter.vue'

const props = defineProps<{
  id?: string
  url: string
  poster?: string
  title?: string
  isLive?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'error', msg: string): void
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
let hls: Hls | null = null
let tsPlayer: mpegts.Player | null = null
const historyStore = useHistoryStore()
let lastUpdateTime = 0
let liveViewRecorded = false
let isDestroying = false
let playbackGeneration = 0
let cleanupMpegtsListeners: (() => void) | null = null
const playbackRequested = ref(true)
let liveHlsAttempted = false
let pendingLiveReconnect: string | null = null
let liveBufferConsumed = false
let liveReconnectAttempts = 0
let liveReconnectTimes: number[] = []
let liveReconnectTimer: ReturnType<typeof setTimeout> | null = null
let switchingLiveSource = false

// TV UI State
const isPlaying = ref(false)
const isBuffering = ref(true)
let bufferingTimeout: ReturnType<typeof setTimeout> | null = null

// Native Android Player Bridge Sync
const isNativePlatform = computed(() => {
  const isAndroid = /android/i.test(navigator.userAgent);
  const hasBridge = typeof (window as any).NativePlayer !== 'undefined';
  return isAndroid || hasBridge || Capacitor.isNativePlatform();
})
let nativePollInterval: ReturnType<typeof setInterval> | null = null

const resumeTime = ref(0)
const hasResumed = ref(false)

function checkResumeTime() {
  if (!props.id || props.isLive) {
    resumeTime.value = 0
    hasResumed.value = true
    return
  }
  const saved = historyStore.getProgress(props.id)
  if (
    saved &&
    saved.currentTime >= 5 &&
    (!saved.duration || (saved.duration > 0 && (saved.currentTime / saved.duration) < 0.95))
  ) {
    resumeTime.value = saved.currentTime
    hasResumed.value = false
  } else {
    resumeTime.value = 0
    hasResumed.value = true
  }
}

function tryApplyResume() {
  if (resumeTime.value <= 0 || hasResumed.value) return
  const video = videoRef.value
  if (!video) return

  if (video.readyState >= 1 || (Number.isFinite(video.duration) && video.duration > 0)) {
    try {
      const maxSeek = video.duration && Number.isFinite(video.duration) && video.duration > 5
        ? Math.max(0, video.duration - 5)
        : resumeTime.value
      const target = Math.min(resumeTime.value, maxSeek)

      if (Math.abs(video.currentTime - target) <= 2) {
        hasResumed.value = true
        currentTime.value = video.currentTime
        return
      }

      video.currentTime = target
    } catch (e) {
      console.warn('Could not seek video to resume position', e)
    }
  }
}

function handleLoadedMetadata(e: Event) {
  const video = e.target as HTMLVideoElement
  duration.value = video.duration || 0
  tryApplyResume()
}

function handleCanPlay() {
  tryApplyResume()
}

function handleSeeked(e: Event) {
  const video = e.target as HTMLVideoElement
  currentTime.value = video.currentTime
  if (resumeTime.value > 0 && !hasResumed.value && video.currentTime >= resumeTime.value - 2) {
    hasResumed.value = true
  }
}

function startNativeSync() {
  if (nativePollInterval) clearInterval(nativePollInterval)
  nativePollInterval = setInterval(() => {
    if (!isNativePlatform.value) return
    try {
      const np = (window as any).NativePlayer
      const pos = (np.getCurrentPosition() || 0) / 1000
      const dur = (np.getDuration() || 0) / 1000
      const playing = np.isPlaying()

      if (dur > 0) duration.value = dur
      if (pos >= 0) currentTime.value = pos
      isPlaying.value = playing

      if (playing || pos > 0 || dur > 0) {
        isBuffering.value = false
      }
      
      // If waiting to resume, don't overwrite saved progress with initial 0s
      if (resumeTime.value > 0 && !hasResumed.value) {
        if (pos >= resumeTime.value - 2) {
          hasResumed.value = true
        }
        return
      }

      const now = Date.now()
      if (props.id && !props.isLive && now - lastUpdateTime > 5000 && pos >= 5) {
        lastUpdateTime = now
        historyStore.updateProgress(
          props.id,
          pos,
          dur
        )
      }
    } catch (e) {
      console.error('Error polling NativePlayer state', e)
    }
  }, 400)
}

function handleWaiting() {
  if (bufferingTimeout) clearTimeout(bufferingTimeout)
  bufferingTimeout = setTimeout(() => {
    isBuffering.value = true
  }, 500)
}

function recordLiveView() {
  if (!props.isLive || !props.id || liveViewRecorded || isDestroying) return
  liveViewRecorded = true
  void historyStore.recordLiveView(props.id).catch(() => {
    liveViewRecorded = false
  })
}

function handlePlaying() {
  recordLiveView()
  switchingLiveSource = false
  if (bufferingTimeout) clearTimeout(bufferingTimeout)
  isBuffering.value = false
  isPlaying.value = true
}

const currentTime = ref(0)
const duration = ref(0)
const showControls = ref(true)
const currentClock = ref('00:00')
const aspectRatio = ref('original')
const showRatioMenu = ref(false)
const RATIOS = [
  { label: 'Original', value: 'original' },
  { label: '4:3', value: '4:3' },
  { label: '16:9', value: '16:9' },
  { label: '21:9', value: '21:9' }
] as const
let hideTimeout: ReturnType<typeof setTimeout> | null = null
let clockInterval: ReturnType<typeof setInterval> | null = null

// Error State
const hasError = ref(false)
const errorTitle = ref('')
const errorDescription = ref('')

// Debug overlay removido
function showDebug(msg: string) {
  console.debug(msg)
}

function showError(title: string, desc: string) {
  hasError.value = true
  errorTitle.value = title
  errorDescription.value = desc
  showControls.value = true
  if (hideTimeout) clearTimeout(hideTimeout)
  if (videoRef.value) videoRef.value.pause()
}

function retryPlay() {
  hasError.value = false
  initPlayer()
}

// Navigation Refs
const topBarRef = ref<InstanceType<typeof PlayerTopBar> | null>(null)
const actionCenterRef = ref<InstanceType<typeof PlayerActionCenter> | null>(null)
const aspectRatioRef = ref<HTMLElement | null>(null)
const progressBarRef = ref<HTMLElement | null>(null)

function focusBack() { setTimeout(() => topBarRef.value?.focusBack(), 10) }
function focusProgress() { setTimeout(() => progressBarRef.value?.focus(), 10) }
function focusPlay() { setTimeout(() => actionCenterRef.value?.focusPlay(), 10) }
function focusFF() { setTimeout(() => actionCenterRef.value?.focusForward(), 10) }
function focusAspectRatio() { setTimeout(() => aspectRatioRef.value?.focus(), 10) }

function openRatioMenu() {
  showRatioMenu.value = true
  setTimeout(() => {
    const menu = document.getElementById('ratio-menu-container')
    if (menu) {
      const firstBtn = menu.querySelector('button') as HTMLElement
      if (firstBtn) firstBtn.focus()
    }
  }, 50)
}

function closeRatioMenu(e?: Event) {
  if (e) {
    e.preventDefault()
    e.stopPropagation()
  }
  showRatioMenu.value = false
  focusAspectRatio()
}

function focusRatioItem(index: number) {
  const menu = document.getElementById('ratio-menu-container')
  if (menu) {
    const btns = menu.querySelectorAll('button')
    if (index >= 0 && index < btns.length) {
      (btns[index] as HTMLElement).focus()
    }
  }
}

function wakeControls() {
  if (hasError.value) {
    showControls.value = true
    if (hideTimeout) clearTimeout(hideTimeout)
    return
  }

  showControls.value = true
  if (hideTimeout) clearTimeout(hideTimeout)
  hideTimeout = setTimeout(() => {
    if (isPlaying.value && !hasError.value) {
      showControls.value = false
    }
  }, 3500)
}

async function requestVideoPlay(video: HTMLVideoElement) {
  const generation = playbackGeneration
  try {
    await video.play()
  } catch (error) {
    if (isDestroying || generation !== playbackGeneration || videoRef.value !== video) return
    // A pause or a source replacement may interrupt a pending play request.
    const name = error && typeof error === 'object' && 'name' in error ? error.name : ''
    if (name === 'AbortError') return
    isPlaying.value = false
    isBuffering.value = false
    if (name === 'NotAllowedError') {
      showControls.value = true
      return
    }
    showError('Erro de Reprodução', 'Não foi possível iniciar o vídeo. Tente novamente.')
  }
}

function togglePlay() {
  if (isNativePlatform.value) {
    try {
      const np = (window as any).NativePlayer
      if (isPlaying.value) {
        np.pauseNativeVideo()
        isPlaying.value = false
      } else {
        np.resumeNativeVideo()
        isPlaying.value = true
      }
    } catch (e) {
      console.error('Failed togglePlay NativePlayer', e)
    }
    wakeControls()
    return
  }

  if (!videoRef.value) return
  if (videoRef.value.paused) {
    playbackRequested.value = true
    if (pendingLiveReconnect && (videoRef.value.ended || liveBufferConsumed)) {
      reconnectLiveStream(pendingLiveReconnect)
    } else {
      void requestVideoPlay(videoRef.value)
    }
  } else {
    playbackRequested.value = false
    videoRef.value.pause()
  }
  wakeControls()
}

const seekingTarget = ref<number | null>(null)
let performSeekTimeout: ReturnType<typeof setTimeout> | null = null
let consecutiveSeeks = 0
let lastSeekTime = 0

function seek(delta: number) {
  const direction = delta > 0 ? 1 : -1;
  const now = Date.now()
  if (now - lastSeekTime < 600) {
    consecutiveSeeks++
  } else {
    consecutiveSeeks = 0
  }
  lastSeekTime = now
  
  let actualDelta = Math.abs(delta)
  if (consecutiveSeeks > 20) actualDelta = 300 // 5 mins per tick
  else if (consecutiveSeeks > 15) actualDelta = 120 // 2 mins per tick
  else if (consecutiveSeeks > 10) actualDelta = 60 // 1 min per tick
  else if (consecutiveSeeks > 5) actualDelta = 30 // 30s per tick
  
  if (seekingTarget.value === null) {
    seekingTarget.value = currentTime.value
  }
  
  seekingTarget.value = Math.max(0, Math.min(duration.value, seekingTarget.value + (direction * actualDelta)))
  
  if (performSeekTimeout) clearTimeout(performSeekTimeout)
  performSeekTimeout = setTimeout(() => {
    if (seekingTarget.value !== null) {
      if (isNativePlatform.value) {
        try {
          const np = (window as any).NativePlayer
          np.seekNativeVideo(seekingTarget.value * 1000)
          currentTime.value = seekingTarget.value
        } catch (e) {
          console.error('Failed seek NativePlayer', e)
        }
      } else if (videoRef.value) {
        videoRef.value.currentTime = seekingTarget.value
      }
      seekingTarget.value = null
      consecutiveSeeks = 0
    }
  }, 600)
  
  wakeControls()
}

function seekTo(event: MouseEvent) {
  const bar = event.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  const pos = (event.clientX - rect.left) / rect.width
  const targetTime = pos * duration.value

  if (isNativePlatform.value) {
    try {
      const np = (window as any).NativePlayer
      np.seekNativeVideo(targetTime * 1000)
      currentTime.value = targetTime
    } catch (e) {
      console.error('Failed seekTo NativePlayer', e)
    }
    wakeControls()
    return
  }

  if (!videoRef.value) return
  videoRef.value.currentTime = targetTime
}

function formatTime(seconds: number) {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function parseRatio(value: string): number {
  const [w, h] = value.split(':').map(Number)
  return w / h
}

const videoTransformStyle = computed<CSSProperties>(() => {
  const v = aspectRatio.value
  if (v === 'original') return { transform: 'none', objectFit: 'contain' }
  if (v === 'stretch') return { transform: 'none', objectFit: 'fill' }
  const target = parseRatio(v)
  const base = 16 / 9
  const scaleX = base > target ? target / base : 1
  const scaleY = base < target ? base / target : 1
  return { transform: `scale(${scaleX}, ${scaleY})`, objectFit: 'contain' }
})

function selectAspectRatio(ratio: string) {
  aspectRatio.value = ratio
  if (isNativePlatform.value) {
    try {
      (window as any).NativePlayer.updateAspectRatioNative(ratio)
    } catch (e) {
      console.error('Failed to update aspect ratio native', e)
    }
  }
}

function handleKeydown(e: KeyboardEvent) {
  // Support standard Back as well as Samsung Tizen (10009), LG webOS (461), and XF86Back
  const isBackKey = e.key === 'Escape' || e.key === 'Backspace' || e.key === 'XF86Back' || e.keyCode === 10009 || e.keyCode === 461
  if (isBackKey) {
    if (showRatioMenu.value) {
      e.preventDefault()
      closeRatioMenu()
    } else if (showControls.value) {
      e.preventDefault()
      showControls.value = false
    } else {
      e.preventDefault()
      wakeControls()
      focusBack()
    }
    return
  }

  // Smart TV dedicated remote media keys (Tizen, webOS, Android TV, Fire TV)
  const isPlayPause = e.key === 'MediaPlayPause' || e.keyCode === 10252 || e.keyCode === 10135 || e.keyCode === 179 || e.keyCode === 85
  if (isPlayPause) {
    e.preventDefault()
    togglePlay()
    return
  }
  const isPlay = e.key === 'MediaPlay' || e.keyCode === 415 || e.keyCode === 126
  if (isPlay) {
    e.preventDefault()
    if (!isPlaying.value) togglePlay()
    return
  }
  const isPause = e.key === 'MediaPause' || e.keyCode === 19 || e.keyCode === 127
  if (isPause) {
    e.preventDefault()
    if (isPlaying.value) togglePlay()
    return
  }
  const isRewind = e.key === 'MediaRewind' || e.keyCode === 412 || e.keyCode === 89
  if (isRewind) {
    if (!props.isLive) {
      e.preventDefault()
      seek(-10)
    }
    return
  }
  const isForward = e.key === 'MediaFastForward' || e.keyCode === 417 || e.keyCode === 90
  if (isForward) {
    if (!props.isLive) {
      e.preventDefault()
      seek(10)
    }
    return
  }
  const isStop = e.key === 'MediaStop' || e.keyCode === 413 || e.keyCode === 86
  if (isStop) {
    e.preventDefault()
    handleClose()
    return
  }

  const isHidden = !showControls.value
  wakeControls()

  const activeEl = document.activeElement
  const isButton = activeEl?.tagName === 'BUTTON'

  switch (e.key) {
    case 'ArrowLeft':
      if (props.isLive) {
        if (isHidden) focusPlay()
        return
      }
      if (isHidden) {
        e.preventDefault()
        focusProgress()
        seek(-10)
      } else if (activeEl === progressBarRef.value || activeEl === document.body) {
        seek(-10)
      }
      break
    case 'ArrowRight':
      if (props.isLive) {
        if (isHidden) focusPlay()
        return
      }
      if (isHidden) {
        e.preventDefault()
        focusProgress()
        seek(10)
      } else if (activeEl === progressBarRef.value || activeEl === document.body) {
        seek(10)
      }
      break
    case 'ArrowUp':
    case 'ArrowDown':
      if (isHidden) {
        e.preventDefault()
        focusPlay()
        return
      }
      break
    case ' ':
    case 'Enter':
      if (isHidden) {
        e.preventDefault()
        focusPlay()
        togglePlay()
        return
      }
      if (!isButton) {
        e.preventDefault()
        togglePlay()
      } else if (e.key === ' ') {
        e.preventDefault()
        ;(activeEl as HTMLElement).click()
      }
      break
  }
}

function isMp4Url(url: string): boolean {
  const lower = url.toLowerCase()
  return /\.mp4(\?.*)?$/i.test(lower)
}

function isMkvUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return /\.(mkv|avi|mov|wmv|flv|m4v)(\?.*)?$/i.test(lower)
}

function isVodUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return isMp4Url(url) || isMkvUrl(url) || lower.includes('/movie/') || lower.includes('/series/')
}

function resolveHlsUrl(url: string): string {
  return url.replace(/\.(mkv|mp4|avi|mov|wmv|flv|m4v)(\?.*)?$/i, '.m3u8')
}

function resolveTsUrl(url: string): string {
  return url.replace(/\.(mkv|mp4|avi|mov|wmv|flv|m4v)(\?.*)?$/i, '.ts')
}

function playNativeWithFallback(url: string, onFail: () => void) {
  const video = videoRef.value!
  showDebug(`[Native HTML5] Tentando: ${url.slice(-60)}`)

  stopPlayback()
  isDestroying = false

  let nativeFailed = false

  const cleanup = () => {
    video.removeEventListener('error', onError)
    video.removeEventListener('playing', onPlaying)
  }

  const onError = (e: Event) => {
    if (nativeFailed) return
    nativeFailed = true
    cleanup()
    const err = (e.target as HTMLVideoElement)?.error
    showDebug(`[Native HTML5] Erro: code=${err?.code} msg=${err?.message} → cascading`)
    onFail()
  }

  const onPlaying = () => {
    cleanup()
    tryApplyResume()
    showDebug(`[Native HTML5] Playback iniciado com sucesso!`)
  }

  video.addEventListener('error', onError, { once: true })
  video.addEventListener('playing', onPlaying, { once: true })

  video.src = url
  video.play().catch(e => {
    showDebug(`[Native HTML5] play() catch: ${e.name} ${e.message}`)
    if (!nativeFailed) {
      nativeFailed = true
      cleanup()
      onFail()
    }
  })
}

function playWithHls(url: string, fallbackUrl: string | null = null, onErrorCallback?: () => void) {
  const video = videoRef.value!
  void stopPlayback()
  isDestroying = false
  hasError.value = false
  isBuffering.value = true

  hls = new Hls({
    debug: false,
    enableWorker: true,
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    startPosition: resumeTime.value > 0 ? resumeTime.value : -1
  })
  const instance = hls
  const generation = playbackGeneration
  const isCurrent = () => !isDestroying && hls === instance && playbackGeneration === generation
  instance.on(Hls.Events.MANIFEST_PARSED, () => {
    if (!isCurrent()) return
    switchingLiveSource = false
    tryApplyResume()
    if (playbackRequested.value) void requestVideoPlay(video)
  })

  instance.on(Hls.Events.LEVEL_LOADED, () => {
    if (isCurrent()) tryApplyResume()
  })

  instance.on(Hls.Events.ERROR, (_event, data) => {
    if (!data.fatal || !isCurrent()) return
    instance.destroy()
    hls = null

    if (onErrorCallback) {
      onErrorCallback()
      return
    }

    if (fallbackUrl) {
      if (mpegts.isSupported()) {
        playWithMpegts(fallbackUrl, false)
      } else {
        showError('Stream Incompatível', `O servidor não suporta reprodução deste conteúdo neste dispositivo.`)
      }
      return
    }
    showError('Erro de Reprodução HLS', 'Não foi possível carregar o vídeo via HLS.')
  })
  instance.loadSource(url)
  instance.attachMedia(video)
}

function reconnectLiveStream(url: string) {
  if (isDestroying || hasError.value || liveReconnectTimer || !playbackRequested.value) return
  // A few seconds of playback must not renew retries indefinitely.
  const now = Date.now()
  liveReconnectTimes = liveReconnectTimes.filter(time => now - time < 60000)
  if (liveReconnectTimes.length >= 3) {
    switchingLiveSource = false
    showError('Conexão instável', 'O canal encerrou a conexão várias vezes em menos de um minuto. A reconexão automática foi interrompida para evitar um ciclo de carregamento.')
    return
  }
  liveReconnectTimes.push(now)
  liveReconnectAttempts = liveReconnectTimes.length
  const generation = playbackGeneration
  switchingLiveSource = true
  isBuffering.value = true
  console.info('[Skue Live] Reconnecting after HTTP end', { attempt: liveReconnectAttempts })
  liveReconnectTimer = setTimeout(() => {
    liveReconnectTimer = null
    if (isDestroying || generation !== playbackGeneration || !playbackRequested.value) return
    pendingLiveReconnect = null
    void stopPlayback()
    isDestroying = false
    playWithMpegts(url, true)
    switchingLiveSource = false
  }, 250 * liveReconnectAttempts)
}

function playWithMpegts(url: string, isLiveStream: boolean = true, onError?: () => void, hasAudioStream: boolean = true) {
  const video = videoRef.value!
  showDebug(`[MPEGTS] Iniciando (isLive=${isLiveStream}, audio=${hasAudioStream}): ${url.slice(-50)}`)

  cleanupMpegtsListeners?.()
  cleanupMpegtsListeners = null
  if (tsPlayer) { tsPlayer.destroy(); tsPlayer = null }

  const recoverLiveHttp = props.isLive && isLiveStream && !/^wss?:/i.test(url)
  const liveLoader = recoverLiveHttp ? createLiveTsLoader({
    isPaused: () => !playbackRequested.value,
    bufferedAhead: () => {
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= video.currentTime && video.currentTime <= video.buffered.end(i)) {
          return video.buffered.end(i) - video.currentTime
        }
      }
      return 0
    },
    onRecovery: diagnostic => console.info('[Skue Live] HTTP recovery', diagnostic),
  }) : undefined
  tsPlayer = mpegts.createPlayer({
    type: 'mpegts',
    isLive: isLiveStream,
    url,
    hasAudio: hasAudioStream,
  }, createMpegtsConfig(isLiveStream, liveLoader))

  const player = tsPlayer
  let mpegtsErrorFired = false

  const handleMpegtsFailure = (msg: string) => {
    if (mpegtsErrorFired || isDestroying || tsPlayer !== player) return
    mpegtsErrorFired = true
    cleanupMpegtsListeners?.()
    cleanupMpegtsListeners = null
    if (tsPlayer) {
      tsPlayer.destroy()
      tsPlayer = null
    }

    if (onError) {
      onError()
    } else {
      showError('Erro de Reprodução', recoverLiveHttp
        ? 'Não foi possível recuperar a transmissão. Tente novamente ou selecione outro canal.'
        : msg)
    }
  }

  const onVideoError = (e: Event) => {
    const err = (e.target as HTMLVideoElement)?.error
    handleMpegtsFailure(`HTML5 error code=${err?.code}`)
  }

  let playTimer: ReturnType<typeof setTimeout> | null = null
  let endTimer: ReturnType<typeof setTimeout> | null = null
  let hlsProbe: AbortController | null = null
  const stopMonitor = isLiveStream ? monitorLivePlayback(video, {
    getNetworkSpeed: () => {
      const info = player.statisticsInfo
      return 'speed' in info ? info.speed : undefined
    },
    report: snapshot => console.warn('[Skue Live] Playback stalled', snapshot),
  }) : () => {}
  cleanupMpegtsListeners = () => {
    stopMonitor()
    video.removeEventListener('error', onVideoError)
    video.removeEventListener('loadedmetadata', tryApplyResume)
    video.removeEventListener('canplay', tryApplyResume)
    if (playTimer) clearTimeout(playTimer)
    if (endTimer) clearTimeout(endTimer)
    hlsProbe?.abort()
  }
  video.addEventListener('error', onVideoError, { once: true })
  video.addEventListener('loadedmetadata', tryApplyResume, { once: true })
  video.addEventListener('canplay', tryApplyResume, { once: true })
  player.on(mpegts.Events.ERROR, (errorType, errorDetail) => {
    handleMpegtsFailure(`type=${errorType} detail=${errorDetail}`)
  })
  player.on(mpegts.Events.LOADING_COMPLETE, () => {
    if (isLiveStream && !isDestroying && tsPlayer === player) {
      console.warn('[Skue Live] Input ended: the live HTTP response was closed.')
      if (!props.isLive) return
      pendingLiveReconnect = url
      const hlsUrl = getLiveHlsAlternative(url)
      if (!liveHlsAttempted && hlsUrl && Hls.isSupported()) {
        liveHlsAttempted = true
        switchingLiveSource = true
        endTimer = setTimeout(async () => {
          if (isDestroying || tsPlayer !== player) return
          hlsProbe = new AbortController()
          const result = await probeLiveHlsManifest(hlsUrl, hlsProbe.signal)
          if (isDestroying || tsPlayer !== player || hlsProbe.signal.aborted) return
          if (!result.supported) {
            switchingLiveSource = false
            console.warn('[Skue Live] HLS candidate rejected; keeping original TS', { status: result.status ?? null })
            if (liveBufferConsumed || video.ended) reconnectLiveStream(url)
            return
          }
          console.info('[Skue Live] Switching finite TS response to HLS')
          playWithHls(hlsUrl, null, () => {
            switchingLiveSource = false
            console.warn('[Skue Live] HLS alternative unavailable; returning to original TS source')
            playWithMpegts(url, true)
          })
        }, 0)
      }
    }
  })
  if (isLiveStream) console.info(recoverLiveHttp ? '[Skue Live] Continuous HTTP MPEG-TS pipeline active' : '[Skue Live] Standard MPEG-TS pipeline active')
  player.attachMediaElement(video)
  player.load()

  playTimer = setTimeout(() => {
    if (isDestroying || tsPlayer !== player) return
    if (playbackRequested.value) void requestVideoPlay(video)
  }, 100)
}

function initPlayer() {
  if (!props.url) return
  playbackRequested.value = true
  liveHlsAttempted = false
  liveReconnectAttempts = 0
  liveReconnectTimes = []
  switchingLiveSource = false
  hasError.value = false
  stopPlayback()
  isDestroying = false

  const url = props.url

  // No Android TV Nativo: usa o VideoView nativo por trás do WebView transparente com a UI Vue por cima!
  if (isNativePlatform.value) {
    showDebug(`[Android TV Native Hardware] Iniciando reprodução via Hardware...`)
    isBuffering.value = true
    try {
      ;(window as any).NativePlayer.playNativeVideo(url)
      startNativeSync()
    } catch (e) {
      console.error('Failed to start native video', e)
      showError('Erro de Reprodução', 'Falha ao iniciar o player nativo do Android TV.')
    }
    return
  }

  // No Navegador Desktop / Web:
  const lower = url.toLowerCase()
  const isHls = lower.endsWith('.m3u8')
  const isTs  = lower.endsWith('.ts') && !isVodUrl(url)
  const isMp4 = isMp4Url(url)
  const isVod = isVodUrl(url)

  if (isHls) {
    if (Hls.isSupported()) {
      showDebug(`[Iniciando] HLS direto: ${url.slice(-50)}`)
      playWithHls(url)
    } else if (videoRef.value && (videoRef.value.canPlayType('application/vnd.apple.mpegurl') || videoRef.value.canPlayType('application/x-mpegURL'))) {
      showDebug(`[Iniciando] HLS nativo SmartTV/Safari: ${url.slice(-50)}`)
      playNativeWithFallback(url, () => {
        showError('Erro de Reprodução HLS', 'Não foi possível carregar o vídeo via HLS nativo na Smart TV.')
      })
    } else {
      showError('Formato Não Suportado', 'Seu dispositivo não suporta reprodução HLS.')
    }

  } else if (isTs && mpegts.isSupported()) {
    showDebug(`[Iniciando] TS direto: ${url.slice(-50)}`)
    playWithMpegts(url, true)

  } else if (isMp4) {
    const hlsUrl = resolveHlsUrl(url)
    const tsUrl  = resolveTsUrl(url)

    const tryTsMpegts = () => {
      playWithMpegts(tsUrl, false, () => {
        showError('Conteúdo Incompatível', 'Este servidor não serve este conteúdo em formato compatível.')
      })
    }

    const tryHls = () => {
      if (Hls.isSupported()) {
        playWithHls(hlsUrl, null, tryTsMpegts)
      } else {
        tryTsMpegts()
      }
    }

    playNativeWithFallback(url, tryHls)

  } else if (isVod) {
    const hlsUrl = resolveHlsUrl(url)
    const tsUrl  = resolveTsUrl(url)

    const tryNative = () => {
      playNativeWithFallback(url, () => {
        showError('Conteúdo Incompatível', 'Este servidor não serve este conteúdo em formato compatível.')
      })
    }

    const tryTsMpegts = () => {
      playWithMpegts(tsUrl, false, tryNative)
    }

    if (Hls.isSupported()) {
      playWithHls(hlsUrl, null, tryTsMpegts)
    } else {
      tryTsMpegts()
    }

  } else if (mpegts.isSupported()) {
    playWithMpegts(url, true)

  } else {
    playNativeWithFallback(url, () => {
      showError('Formato Não Suportado', 'Este formato de vídeo não é compatível com este dispositivo.')
    })
  }
}

function handleNativeError(e: Event) {
  const video = e.target as HTMLVideoElement
  if (!video.error) return
  if (isDestroying) return
  const code = video.error.code
  if (code === 4) {
    showError('Formato Não Suportado', `Este dispositivo não consegue decodificar este conteúdo.\nCódigo: MEDIA_ERR_SRC_NOT_SUPPORTED`)
  } else if (code === 2) {
    showError('Erro de Rede', 'A conexão de rede falhou durante o carregamento do vídeo.')
  } else if (code === 3) {
    showError('Erro de Decodificação', `Erro ao decodificar o vídeo (código ${code}).`)
  } else {
    showError('Erro de Reprodução', `Erro no player (código ${code}).`)
  }
}

function handleTimeUpdate(e: Event) {
  if (isNativePlatform.value || isDestroying) return
  const video = e.target as HTMLVideoElement
  currentTime.value = video.currentTime
  duration.value = video.duration || 0

  if (resumeTime.value > 0 && !hasResumed.value) {
    if (video.currentTime >= resumeTime.value - 2) {
      hasResumed.value = true
    } else {
      tryApplyResume()
      return
    }
  }

  const now = Date.now()
  if (props.id && !props.isLive && now - lastUpdateTime > 3000 && video.currentTime >= 5) {
    lastUpdateTime = now
    historyStore.updateProgress(
      props.id,
      video.currentTime,
      video.duration || 0
    )
  }
}

async function stopPlayback() {
  if (isDestroying) return
  isDestroying = true
  playbackGeneration++
  pendingLiveReconnect = null
  liveBufferConsumed = false
  if (liveReconnectTimer) clearTimeout(liveReconnectTimer)
  liveReconnectTimer = null

  // Snapshot progress, but release the old source synchronously before any await.
  const progress = props.id && !props.isLive && currentTime.value >= 5
    ? { id: props.id, time: currentTime.value, duration: duration.value || 0 }
    : null

  cleanupMpegtsListeners?.()
  cleanupMpegtsListeners = null
  if (nativePollInterval) {
    clearInterval(nativePollInterval)
    nativePollInterval = null
  }
  if (isNativePlatform.value) {
    try {
      ;(window as any).NativePlayer.stopNativeVideo()
    } catch (e) {
      console.error('Error stopping NativePlayer', e)
    }
  }
  if (hls) {
    hls.destroy()
    hls = null
  }
  if (tsPlayer) {
    tsPlayer.destroy()
    tsPlayer = null
  }
  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.removeAttribute('src')
    videoRef.value.load()
  }
  if (bufferingTimeout) clearTimeout(bufferingTimeout)
  isPlaying.value = false

  if (progress) {
    try {
      await historyStore.updateProgress(progress.id, progress.time, progress.duration)
    } catch (e) {
      console.error('Error saving progress on stopPlayback', e)
    }
  }
}

async function handleClose() {
  await stopPlayback()
  emit('close')
}

function handlePlaybackEnded() {
  if (isDestroying) return
  if (props.isLive) {
    if (!isNativePlatform.value) {
      liveBufferConsumed = true
      if (switchingLiveSource) return
      if (pendingLiveReconnect) {
        reconnectLiveStream(pendingLiveReconnect)
        return
      }
    }
    console.warn('[Skue Live] Media ended unexpectedly')
    showError('Transmissão interrompida', 'O sinal deste canal foi encerrado. Tente conectar novamente.')
    return
  }
  if (isNativePlatform.value) void handleClose()
}

function onBeforeUnload() {
  if (props.id && !props.isLive && currentTime.value >= 5) {
    historyStore.updateProgress(props.id, currentTime.value, duration.value || 0)
  }
}

function updateClock() {
  const now = new Date()
  currentClock.value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function applyNativePlayerClass() {
  if (isNativePlatform.value && !hasError.value) {
    document.body.classList.add('native-player-active')
    document.documentElement.classList.add('native-player-active')
  } else {
    document.body.classList.remove('native-player-active')
    document.documentElement.classList.remove('native-player-active')
  }
}

watch([isNativePlatform, hasError], () => {
  applyNativePlayerClass()
})

onMounted(() => {
  applyNativePlayerClass()
  updateClock()
  clockInterval = setInterval(updateClock, 1000)
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('mousemove', wakeControls)
  window.addEventListener('beforeunload', onBeforeUnload)

  // Native Android TV Event Listeners
  ;(window as any).onNativePlayerPrepared = () => {
    isBuffering.value = false
    isPlaying.value = true
    if (resumeTime.value > 0 && !hasResumed.value) {
      try {
        const np = (window as any).NativePlayer
        np.seekNativeVideo(resumeTime.value * 1000)
        currentTime.value = resumeTime.value
        hasResumed.value = true
      } catch (e) {
        console.error('Failed to seek NativePlayer on prepare', e)
      }
    }
    wakeControls()
  }
  ;(window as any).onNativePlayerRenderingStart = () => {
    recordLiveView()
    isBuffering.value = false
    isPlaying.value = true
    wakeControls()
  }
  ;(window as any).onNativePlayerVideoSizeChanged = () => {
    selectAspectRatio(aspectRatio.value)
  }
  ;(window as any).onNativePlayerError = (what: number, extra: number) => {
    showError('Erro no Player Nativo', `O hardware da TV reportou um erro ao decodificar este conteúdo (Erro ${what}, ${extra}).`)
  }
  ;(window as any).onNativePlayerEnded = () => {
    if (isNativePlatform.value) handlePlaybackEnded()
  }

  checkResumeTime()
  initPlayer()
  wakeControls()
  
  setTimeout(() => {
    focusPlay()
  }, 100)

  if (isNativePlatform.value) {
    App.addListener('backButton', () => {
      if (showRatioMenu.value) {
        closeRatioMenu()
      } else if (showControls.value) {
        showControls.value = false
      } else {
        wakeControls()
        focusBack()
      }
    }).then(listener => {
      backListener = listener
    })
  }
})

let backListener: any = null

watch(() => [props.url, props.id], () => {
  liveViewRecorded = false
  checkResumeTime()
  initPlayer()
})

onUnmounted(() => {
  delete (window as any).onNativePlayerPrepared
  delete (window as any).onNativePlayerRenderingStart
  delete (window as any).onNativePlayerVideoSizeChanged
  delete (window as any).onNativePlayerError
  delete (window as any).onNativePlayerEnded

  if (backListener) {
    backListener.remove()
  }

  document.body.classList.remove('native-player-active')
  stopPlayback()
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('mousemove', wakeControls)
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (hideTimeout) clearTimeout(hideTimeout)
  if (clockInterval) clearInterval(clockInterval)
  if (bufferingTimeout) clearTimeout(bufferingTimeout)
})
</script>

<template>
  <Teleport to="body">
    <div :class="['fixed inset-0 z-[99999] flex flex-col select-none overflow-hidden', isNativePlatform && !hasError ? 'bg-transparent' : 'bg-black']" data-tv-modal @click="wakeControls" @mousemove="wakeControls">

    
    <div :class="['flex-1 min-h-0 overflow-hidden relative transition-all', isNativePlatform && !hasError ? 'bg-transparent' : 'bg-black', { 'cursor-none': !showControls }]">
      <video
        v-if="!isNativePlatform"
        ref="videoRef"
        class="absolute inset-0 w-full h-full object-contain"
        :style="videoTransformStyle"
        :autoplay="playbackRequested"
        :poster="!isLive ? poster : undefined"
        @timeupdate="handleTimeUpdate"
        @loadedmetadata="handleLoadedMetadata"
        @canplay="handleCanPlay"
        @seeked="handleSeeked"
        @play="isPlaying = true; wakeControls()"
        @pause="isPlaying = false; wakeControls()"
        @waiting="handleWaiting"
        @playing="handlePlaying"
        @ended="handlePlaybackEnded"
        @click="togglePlay"
        @error="handleNativeError"
      ></video>
      <!-- CLEAN PRELOAD / BUFFERING SCREEN -->
      <div v-if="isBuffering && !hasError && seekingTarget === null" class="absolute inset-0 z-30 flex items-center justify-center pointer-events-none transition-opacity duration-300">
        <div class="animate-spin rounded-full h-12 w-12 border-2 border-white/20 border-t-white"></div>
      </div>
      
      <!-- ERROR OVERLAY -->
      <div v-if="hasError" class="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 pointer-events-auto">
        <div class="bg-[#14161a] border border-white/10 rounded-2xl p-8 max-w-md w-full flex flex-col items-center shadow-2xl text-center">
          <div class="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center mb-4 text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>

          <h2 class="text-xl font-semibold text-white mb-2 tracking-tight">{{ errorTitle }}</h2>
          <p class="text-gray-400 text-xs md:text-sm leading-relaxed mb-6">{{ errorDescription }}</p>
          
          <div class="flex flex-wrap justify-center gap-3 w-full">
            <button @click="handleClose" class="flex-1 px-5 py-2.5 bg-white/[0.07] hover:bg-white/[0.12] focus:bg-white/20 text-gray-200 font-medium text-xs rounded-xl border border-white/10 outline-none">
              Voltar
            </button>
            
            <button @click="retryPlay" class="flex-1 px-5 py-2.5 bg-white hover:bg-gray-200 text-black font-semibold text-xs rounded-xl flex items-center justify-center gap-2 outline-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
      
      <!-- Custom TV-Friendly UI Overlay (Apple Liquid Glass) -->
      <Transition name="fade">
        <div v-show="showControls" class="absolute inset-0 flex flex-col justify-between pointer-events-none">
          
          <!-- Top Bar -->
          <div class="p-3 md:px-6 md:py-4 pointer-events-auto bg-gradient-to-b from-black/70 via-black/20 to-transparent">
            <PlayerTopBar
              ref="topBarRef"
              :title="title || 'Reproduzindo'"
              :subtitle="isLive ? 'Ao vivo • TV' : 'Filme • Reprodução'"
              :is-live="Boolean(isLive)"
              :current-clock="currentClock"
              @close="handleClose()"
              @navigate-down="focusPlay"
            />
          </div>

          <!-- Bottom Full-Width Controls Overlay (Compact, canto a canto) -->
          <div v-if="!hasError" class="w-full pointer-events-auto p-3 md:px-6 md:pb-4 pt-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col gap-2">
            
            <!-- Row 1: Aspect Ratio Button (título exibido apenas no PlayerTopBar) -->
            <div class="flex items-center justify-end gap-3 w-full">

              <!-- Aspect Ratio Selector Pill -->
              <div class="relative">
                <button
                  ref="aspectRatioRef"
                  @click.stop="openRatioMenu"
                  @keydown.enter.prevent="openRatioMenu"
                  @keydown.left.prevent="!isLive ? focusFF() : focusPlay()"
                  @keydown.right.prevent
                  @keydown.up.prevent="focusBack"
                  @keydown.down.prevent="focusProgress"
                  class="px-2.5 py-0.5 rounded-full border text-[11px] font-bold backdrop-blur-md outline-none focus:outline-none focus:bg-white/40 flex items-center gap-1 bg-white/10 border-white/10 text-white/90 hover:bg-white/20 hover:text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="14" x="3" y="5" rx="2"/><path d="M5 9h4M9 9v4"/></svg>
                  <span>{{ RATIOS.find(r => r.value === aspectRatio)?.label || 'Tela' }}</span>
                </button>

                <Transition name="fade">
                  <div v-show="showRatioMenu" id="ratio-menu-container" class="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[120px] z-50 p-1">
                    <button
                      v-for="(r, index) in RATIOS"
                      :key="r.value"
                      @click.stop="selectAspectRatio(r.value)"
                      @keydown.enter.prevent="selectAspectRatio(r.value)"
                      @keydown.up.prevent="focusRatioItem(index - 1)"
                      @keydown.down.prevent="focusRatioItem(index + 1)"
                      @keydown.left.prevent
                      @keydown.right.prevent
                      :class="['w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold outline-none focus:outline-none focus:bg-white/40', aspectRatio === r.value ? 'bg-white/25 text-white font-bold' : 'text-white/70 hover:bg-white/15 hover:text-white']"
                    >{{ r.label }}</button>
                  </div>
                </Transition>
              </div>
            </div>

            <!-- Row 2: Centralized Refined Player Buttons (Compact & Balanced) -->
            <div class="flex items-center justify-center gap-4 py-0.5">
              <PlayerActionCenter
                ref="actionCenterRef"
                :is-live="Boolean(isLive)"
                :is-playing="isPlaying"
                @rewind="seek(-10)"
                @toggle-play="togglePlay"
                @forward="seek(10)"
                @navigate-up="focusBack"
                @navigate-down="focusProgress"
                @navigate-right="focusAspectRatio"
              />
            </div>

            <!-- Row 3: Progress Bar (Edge-to-Edge, Posicionada Abaixo dos Botões) -->
            <div v-if="!isLive" class="w-full flex items-center gap-2.5 mt-0.5">
              <span class="text-white/80 text-[11px] font-mono font-semibold min-w-[38px] text-right">{{ formatTime(seekingTarget !== null ? seekingTarget : currentTime) }}</span>
              
              <div 
                ref="progressBarRef"
                tabindex="0"
                @keydown.up.prevent="focusPlay"
                @keydown.left.prevent="seek(-10)"
                @keydown.right.prevent="seek(10)"
                @click="seekTo"
                class="flex-1 h-1.5 bg-white/20 hover:h-2 focus:h-2 outline-none focus:outline-none focus:bg-white/40 focus:ring-2 focus:ring-white/50 focus:scale-[1.01] rounded-full cursor-pointer relative overflow-hidden shadow-inner" 
              >
                <div class="absolute left-0 h-full bg-white rounded-full" :style="{ width: duration ? ((seekingTarget !== null ? seekingTarget : currentTime) / duration) * 100 + '%' : '0%' }"></div>
              </div>

              <span class="text-white/80 text-[11px] font-mono font-semibold min-w-[38px]">{{ formatTime(duration) }}</span>
            </div>

          </div>
        </div>
      </Transition>
    </div>
  </div>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
