<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, type CSSProperties } from 'vue'
import Hls from 'hls.js'
import mpegts from 'mpegts.js'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { useHistoryStore } from '../stores/history'

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

function handlePlaying() {
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
const backButtonRef = ref<HTMLElement | null>(null)
const aspectRatioRef = ref<HTMLElement | null>(null)
const rewButtonRef = ref<HTMLElement | null>(null)
const playButtonRef = ref<HTMLElement | null>(null)
const ffButtonRef = ref<HTMLElement | null>(null)
const progressBarRef = ref<HTMLElement | null>(null)

function focusBack() { setTimeout(() => backButtonRef.value?.focus(), 10) }
function focusProgress() { setTimeout(() => progressBarRef.value?.focus(), 10) }
function focusPlay() { setTimeout(() => playButtonRef.value?.focus(), 10) }
function focusREW() { setTimeout(() => rewButtonRef.value?.focus(), 10) }
function focusFF() { setTimeout(() => ffButtonRef.value?.focus(), 10) }
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
    videoRef.value.play()
  } else {
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
  if (e.key === 'Escape' || e.key === 'Backspace') {
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
  if (hls) { hls.destroy(); hls = null }

  hls = new Hls({
    debug: false,
    enableWorker: true,
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
  })
  hls.loadSource(url)
  hls.attachMedia(video)

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    video.play().catch(e => console.error('HLS play prevented', e))
  })

  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (!data.fatal) return
    hls?.destroy()
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
}

function playWithMpegts(url: string, isLiveStream: boolean = true, onError?: () => void, hasAudioStream: boolean = true) {
  const video = videoRef.value!
  showDebug(`[MPEGTS] Iniciando (isLive=${isLiveStream}, audio=${hasAudioStream}): ${url.slice(-50)}`)

  if (tsPlayer) { tsPlayer.destroy(); tsPlayer = null }

  tsPlayer = mpegts.createPlayer({
    type: 'mpegts',
    isLive: isLiveStream,
    url,
    hasAudio: hasAudioStream,
  }, {
    enableWorker: true,
    enableStashBuffer: !isLiveStream,
    stashInitialSize: isLiveStream ? 128 : 1024,
  })

  let mpegtsErrorFired = false

  const handleMpegtsFailure = (msg: string) => {
    if (mpegtsErrorFired) return
    mpegtsErrorFired = true
    video.removeEventListener('error', onVideoError)
    if (tsPlayer) {
      tsPlayer.destroy()
      tsPlayer = null
    }

    if (onError) {
      onError()
    } else {
      showError('Erro de Reprodução', msg)
    }
  }

  const onVideoError = (e: Event) => {
    const err = (e.target as HTMLVideoElement)?.error
    handleMpegtsFailure(`HTML5 error code=${err?.code}`)
  }

  video.addEventListener('error', onVideoError, { once: true })
  tsPlayer.attachMediaElement(video)
  tsPlayer.load()

  setTimeout(() => {
    if (!tsPlayer) return
    const result = tsPlayer.play()
    if (result instanceof Promise) {
      result.catch(e => {
        console.warn('MPEGTS play() interrupted:', e.message)
      })
    }
  }, 100)

  tsPlayer.on(mpegts.Events.ERROR, (errorType, errorDetail) => {
    handleMpegtsFailure(`type=${errorType} detail=${errorDetail}`)
  })
}

function initPlayer() {
  if (!props.url) return
  hasError.value = false
  stopPlayback()

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

  if (isHls && Hls.isSupported()) {
    showDebug(`[Iniciando] HLS direto: ${url.slice(-50)}`)
    playWithHls(url)

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
  if (isNativePlatform.value) return
  const video = e.target as HTMLVideoElement
  currentTime.value = video.currentTime
  duration.value = video.duration || 0

  const now = Date.now()
  if (props.id && now - lastUpdateTime > 5000) {
    lastUpdateTime = now
    historyStore.updateProgress(
      props.id,
      video.currentTime,
      video.duration || 0
    )
  }
}

function stopPlayback() {
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

  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.removeAttribute('src')
    videoRef.value.load()
  }
  if (hls) {
    hls.destroy()
    hls = null
  }
  if (tsPlayer) {
    tsPlayer.destroy()
    tsPlayer = null
  }
}

function handleClose() {
  stopPlayback()
  emit('close')
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

  // Native Android TV Event Listeners
  ;(window as any).onNativePlayerPrepared = () => {
    isBuffering.value = false
    isPlaying.value = true
    wakeControls()
  }
  ;(window as any).onNativePlayerRenderingStart = () => {
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
    handleClose()
  }

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

watch(() => props.url, () => {
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
        autoplay
        :poster="!isLive ? poster : undefined"
        @timeupdate="handleTimeUpdate"
        @loadedmetadata="duration = ($event.target as HTMLVideoElement).duration"
        @play="handlePlaying(); wakeControls()"
        @pause="isPlaying = false; wakeControls()"
        @waiting="handleWaiting"
        @playing="handlePlaying"
        @click="togglePlay"
        @error="handleNativeError"
      ></video>
      <!-- CLEAN PRELOAD / BUFFERING SCREEN -->
      <div v-if="isBuffering && !hasError && seekingTarget === null" class="absolute inset-0 z-30 flex items-center justify-center pointer-events-none transition-opacity duration-300">
        <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
      </div>
      
      <!-- ERROR OVERLAY (Apple Liquid Glass Modal) -->
      <div v-if="hasError" class="absolute inset-0 z-40 bg-black/85 backdrop-blur-2xl flex flex-col items-center justify-center p-6 pointer-events-auto">
        <div class="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-3xl p-8 md:p-10 max-w-lg w-full flex flex-col items-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] text-center relative overflow-hidden">
          <div class="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/15 via-white/5 to-transparent pointer-events-none"></div>
          
          <div class="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-400"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>

          <h2 class="text-2xl md:text-3xl font-extrabold text-white mb-3 tracking-tight">{{ errorTitle }}</h2>
          <p class="text-white/70 text-sm md:text-base leading-relaxed mb-8 font-normal">{{ errorDescription }}</p>
          
          <div class="flex flex-wrap justify-center gap-4 w-full">
            <button @click="handleClose" class="px-6 py-3.5 bg-white/10 hover:bg-white/20 focus:bg-white/30 text-white font-semibold rounded-2xl border border-white/20 backdrop-blur-md outline-none focus:outline-none shadow-md">
              Voltar
            </button>
            
            <button @click="retryPlay" class="px-6 py-3.5 bg-gradient-to-r from-blue-500/90 to-indigo-600/90 hover:from-blue-400 hover:to-indigo-500 text-white font-bold rounded-2xl border border-blue-300/40 backdrop-blur-md flex items-center gap-2.5 outline-none focus:outline-none shadow-[0_0_25px_rgba(59,130,246,0.4)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
      
      <!-- Custom TV-Friendly UI Overlay (Apple Liquid Glass) -->
      <Transition name="fade">
        <div v-show="showControls" class="absolute inset-0 flex flex-col justify-between pointer-events-none">
          
          <!-- Top Bar -->
          <div class="p-3 md:px-6 md:py-4 flex justify-between items-center pointer-events-auto bg-gradient-to-b from-black/70 via-black/20 to-transparent">
            <!-- Left: Back Button Liquid Pill (Compact Glass Circle) -->
            <button 
              ref="backButtonRef"
              @click="handleClose()" 
              @keydown.down.prevent="focusPlay"
              @keydown.left.prevent
              @keydown.right.prevent
              @keydown.up.prevent
              class="group text-white/90 hover:text-white focus:text-white focus:bg-white/40 focus:scale-105 outline-none focus:outline-none w-8 h-8 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 shadow-md flex items-center justify-center" 
              aria-label="Fechar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>

            <!-- Right: Clock Pill -->
            <div class="px-3 py-1 rounded-full bg-white/15 backdrop-blur-xl border border-white/20 shadow-md text-white text-[11px] font-semibold tracking-wider flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {{ currentClock }}
            </div>
          </div>

          <!-- Bottom Full-Width Controls Overlay (Compact, canto a canto) -->
          <div v-if="!hasError" class="w-full pointer-events-auto p-3 md:px-6 md:pb-4 pt-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col gap-2">
            
            <!-- Row 1: Title & Aspect Ratio Button -->
            <div class="flex items-center justify-between gap-3 w-full">
              <div class="flex items-center gap-2">
                <div v-if="isLive" class="bg-gradient-to-r from-red-500 to-rose-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                  LIVE
                </div>
                <h2 class="text-sm md:text-base font-bold text-white tracking-tight drop-shadow-md truncate max-w-lg">{{ title || 'Reproduzindo' }}</h2>
              </div>

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
              <button 
                v-if="!isLive"
                ref="rewButtonRef"
                @click="seek(-10)" 
                @keydown.left.prevent
                @keydown.right.prevent="focusPlay"
                @keydown.up.prevent="focusBack"
                @keydown.down.prevent="focusProgress"
                class="text-white/80 hover:text-white focus:text-white focus:bg-white/40 focus:scale-105 outline-none focus:outline-none w-8 h-8 rounded-full bg-white/10 border border-white/10 backdrop-blur-md shadow-md flex items-center justify-center" 
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/></svg>
              </button>

              <!-- Central Main Play/Pause Button (Compact 40px Glass Pill) -->
              <button 
                ref="playButtonRef"
                @click="togglePlay" 
                @keydown.left.prevent="!isLive && focusREW()"
                @keydown.right.prevent="!isLive ? focusFF() : focusAspectRatio()"
                @keydown.up.prevent="focusBack"
                @keydown.down.prevent="focusProgress"
                class="text-white hover:scale-105 focus:scale-105 focus:bg-white/40 outline-none focus:outline-none w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xl border border-white/10 shadow-[0_0_12px_rgba(255,255,255,0.1)] flex items-center justify-center" 
              >
                <svg v-if="!isPlaying" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" class="ml-0.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              </button>

              <button 
                v-if="!isLive"
                ref="ffButtonRef"
                @click="seek(10)" 
                @keydown.left.prevent="focusPlay"
                @keydown.right.prevent="focusAspectRatio"
                @keydown.up.prevent="focusBack"
                @keydown.down.prevent="focusProgress"
                class="text-white/80 hover:text-white focus:text-white focus:bg-white/40 focus:scale-105 outline-none focus:outline-none w-8 h-8 rounded-full bg-white/10 border border-white/10 backdrop-blur-md shadow-md flex items-center justify-center" 
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/></svg>
              </button>
            </div>

            <!-- Row 3: Progress Bar (Edge-to-Edge, Posicionada Abaixo dos Botões) -->
            <div v-if="!isLive" class="w-full flex items-center gap-2.5 mt-0.5">
              <span class="text-white/80 text-[11px] font-mono font-semibold min-w-[38px] text-right">{{ formatTime(seekingTarget !== null ? seekingTarget : currentTime) }}</span>
              
              <div 
                ref="progressBarRef"
                tabindex="0"
                @keydown.up.prevent="focusPlay"
                @click="seekTo"
                class="flex-1 h-1.5 bg-white/20 hover:h-2 focus:h-2 outline-none focus:outline-none focus:bg-white/40 focus:ring-2 focus:ring-white/50 focus:scale-[1.01] rounded-full cursor-pointer relative overflow-hidden shadow-inner" 
              >
                <div class="absolute left-0 h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" :style="{ width: duration ? ((seekingTarget !== null ? seekingTarget : currentTime) / duration) * 100 + '%' : '0%' }"></div>
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
