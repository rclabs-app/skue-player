<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, type CSSProperties } from 'vue'
import Hls from 'hls.js'
import mpegts from 'mpegts.js'

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
const isPlaying = ref(false) // Start false until actually playing
const isBuffering = ref(true) // Start true
let bufferingTimeout: ReturnType<typeof setTimeout> | null = null

function handleWaiting() {
  if (bufferingTimeout) clearTimeout(bufferingTimeout)
  bufferingTimeout = setTimeout(() => {
    isBuffering.value = true
  }, 500) // Only show spinner if buffering for more than 500ms
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
  { label: '16:9', value: '16:9' },
  { label: '4:3', value: '4:3' },
  { label: '3:2', value: '3:2' },
  { label: '21:9', value: '21:9' },
  { label: 'Esticar', value: 'stretch' },
] as const
let hideTimeout: ReturnType<typeof setTimeout> | null = null
let clockInterval: ReturnType<typeof setInterval> | null = null

// Error State
const hasError = ref(false)
const errorTitle = ref('')
const errorDescription = ref('')

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
  if (!videoRef.value) return
  if (videoRef.value.paused) {
    videoRef.value.play()
  } else {
    videoRef.value.pause()
  }
  wakeControls()
}

function seek(delta: number) {
  if (!videoRef.value) return
  videoRef.value.currentTime += delta
  wakeControls()
}

function seekTo(event: MouseEvent) {
  if (!videoRef.value) return
  const bar = event.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  const pos = (event.clientX - rect.left) / rect.width
  videoRef.value.currentTime = pos * duration.value
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
  // Reajusta a proporção relativa à base 16:9 da tela, corrigindo streams
  // com sinal de aspect ratio incorreto (padrão usado pelos players de IPTV).
  const target = parseRatio(v)
  const base = 16 / 9
  const scaleX = base > target ? target / base : 1
  const scaleY = base < target ? base / target : 1
  return { transform: `scale(${scaleX}, ${scaleY})`, objectFit: 'contain' }
})

function selectAspectRatio(ratio: string) {
  aspectRatio.value = ratio
  showRatioMenu.value = false
  wakeControls()
}

function handleKeydown(e: KeyboardEvent) {
  wakeControls()
  
  if (e.key === 'Escape' || e.key === 'Backspace') {
    handleClose()
    return
  }

  const activeEl = document.activeElement
  const isButton = activeEl?.tagName === 'BUTTON'

  switch (e.key) {
    case 'ArrowLeft':
      seek(-10)
      break
    case 'ArrowRight':
      seek(10)
      break
    case ' ':
    case 'Enter':
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

function initPlayer() {
  if (!videoRef.value || !props.url) return
  hasError.value = false

  // Make sure we stop and clean up any ongoing stream before starting a new one
  stopPlayback()

  const video = videoRef.value
  const lowerUrl = props.url.toLowerCase()
  
  const isMp4 = lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.mkv') || lowerUrl.includes('/movie/')
  const isHls = lowerUrl.endsWith('.m3u8')
  // Se não for HLS nem MP4, assumimos que é uma stream MPEG-TS direta comum em IPTV
  const isTs = !isHls && !isMp4

  if (isHls && Hls.isSupported()) {
    hls = new Hls({
      debug: false,
      enableWorker: true
    })
    
    hls.loadSource(props.url)
    hls.attachMedia(video)
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(e => console.error("Auto-play prevented", e))
    })
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls?.destroy()
            const code = data.response?.code
            if (code === 0) {
              showError('Bloqueio do Navegador (CORS)', 'O provedor da playlist bloqueou a reprodução através do navegador. Este canal normalmente funciona direto no aplicativo de TV.')
            } else if (code === 403 || code === 404) {
              showError('Sinal Indisponível', `O provedor retornou erro ${code}. O canal pode estar offline, bloqueado ou o link expirou.`)
            } else {
              showError('Erro de Conexão', 'Não foi possível conectar ao servidor do vídeo. Verifique sua internet ou tente novamente mais tarde.')
            }
            break
          case Hls.ErrorTypes.MEDIA_ERROR:
            showError('Erro de Mídia', 'Ocorreu um erro fatal ao decodificar a mídia. O formato pode estar corrompido ou não ser suportado.')
            hls?.destroy()
            break
          default:
            showError('Erro de Reprodução', 'Um erro irrecuperável ocorreu ao tentar reproduzir o stream.')
            hls?.destroy()
            break
        }
      }
    })
  } else if (isTs && mpegts.isSupported()) {
    tsPlayer = mpegts.createPlayer({
      type: 'mpegts',
      isLive: true,
      url: props.url
    }, {
      enableWorker: true,
      enableStashBuffer: false,
      stashInitialSize: 128,
      liveBufferLatencyChasing: true,
      liveBufferLatencyMaxLatency: 15,
      liveBufferLatencyMinRemain: 2
    })
    
    tsPlayer.attachMediaElement(video)
    tsPlayer.load()
    const playResult = tsPlayer.play()
    if (playResult instanceof Promise) {
      playResult.catch(e => {
        console.error("TS Auto-play prevented", e)
      })
    }
    
    tsPlayer.on(mpegts.Events.ERROR, (errorType, errorDetail, errorInfo) => {
      console.error('MPEGTS Error', errorType, errorDetail, errorInfo)
      if (errorType === mpegts.ErrorTypes.NETWORK_ERROR) {
        showError('Erro de Conexão (TS)', 'O servidor encerrou a conexão ou está inacessível. O canal pode estar offline.')
      } else {
        showError('Erro de Reprodução', `Ocorreu um erro ao tentar exibir o canal (${errorDetail}).`)
      }
    })
  } else if (video.canPlayType('application/vnd.apple.mpegurl') || video.canPlayType('application/x-mpegURL') || isMp4) {
    // Native support (Safari / iOS / Smart TVs) or direct MP4 playback
    video.src = props.url
    video.play().catch(e => {
      if (e.name === 'NotSupportedError') {
        showError('Formato Não Suportado', 'O formato do vídeo não é compatível com seu navegador. Tente no app da TV.')
      } else {
        console.error("Auto-play prevented", e)
      }
    })
  } else {
    // Attempt to play natively, catch unsupported via @error handler
    video.src = props.url
    video.play().catch(e => {
      if (e.name === 'NotSupportedError') {
        showError('Formato Não Suportado', 'Este navegador não suporta a reprodução direta deste formato de vídeo (.ts, .mkv). Use o aplicativo de TV.')
      } else {
        console.error("Playback error", e)
        showError('Erro de Reprodução', 'Falha ao iniciar o vídeo nativamente.')
      }
    })
  }
}

function handleNativeError(e: Event) {
  const video = e.target as HTMLVideoElement;
  if (!video.error) return;
  if (video.error.code === 4) { // MEDIA_ERR_SRC_NOT_SUPPORTED
    showError('Formato Não Suportado', 'Este navegador não suporta a reprodução direta deste formato de vídeo. Use o aplicativo de TV.');
  } else if (video.error.code === 2) { // MEDIA_ERR_NETWORK
    showError('Erro de Rede', 'A conexão de rede falhou durante o carregamento do vídeo. Verifique sua conexão.');
  } else {
    showError('Erro de Reprodução', 'Ocorreu um erro nativo no player (Código: ' + video.error.code + ').');
  }
}

watch(() => props.url, () => {
  initPlayer()
})

onMounted(async () => {
  initPlayer()
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('mousemove', wakeControls)
  wakeControls()
  
  if (props.id && videoRef.value && !props.isLive) {
    // Check if we have history and resume
    await historyStore.loadHistory()
    const hist = historyStore.getProgress(props.id)
    if (hist && hist.currentTime > 0) {
      // Small delay to ensure video is ready
      videoRef.value.addEventListener('loadedmetadata', () => {
        // Only resume if we aren't completely finished
        if (hist.currentTime < hist.duration * 0.95) {
          videoRef.value!.currentTime = hist.currentTime
        }
      }, { once: true })
    }
  }
  
  // Start clock
  updateClock()
  clockInterval = setInterval(updateClock, 60000)
})

function updateClock() {
  const now = new Date()
  currentClock.value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function handleTimeUpdate() {
  if (!videoRef.value) return
  
  currentTime.value = videoRef.value.currentTime
  duration.value = videoRef.value.duration || 0

  if (!props.id) return
  
  const now = Date.now()
  // Update every 5 seconds to avoid DB spam
  if (now - lastUpdateTime > 5000) {
    lastUpdateTime = now
    historyStore.updateProgress(
      props.id,
      videoRef.value.currentTime,
      videoRef.value.duration || 0
    )
  }
}

function stopPlayback() {
  // 1. Pause and clear the video element immediately
  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.removeAttribute('src')
    videoRef.value.load() // abort any ongoing network requests
  }
  // 2. Destroy instances
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

onUnmounted(() => {
  stopPlayback()
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('mousemove', wakeControls)
  if (hideTimeout) clearTimeout(hideTimeout)
  if (clockInterval) clearInterval(clockInterval)
  if (bufferingTimeout) clearTimeout(bufferingTimeout)
})
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black flex flex-col" @click="wakeControls" @mousemove="wakeControls">
    
    <div class="flex-1 min-h-0 overflow-hidden bg-black relative transition-all" :class="{ 'cursor-none': !showControls }">
      <video
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
      <div v-if="isBuffering && !hasError" class="absolute inset-0 z-30 bg-black/50 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-300">
        <div class="w-12 h-12 border-4 border-gray-700 border-t-primary rounded-full animate-spin mb-4 shadow-lg"></div>
        <p class="text-gray-400 font-medium">Carregando canal...</p>
      </div>
      
      <!-- ERROR OVERLAY -->
      <div v-if="hasError" class="absolute inset-0 z-40 bg-black/95 flex flex-col items-center justify-center p-6 backdrop-blur-md pointer-events-auto">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-red-500 mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        <h2 class="text-2xl md:text-3xl font-bold text-white mb-3 text-center">{{ errorTitle }}</h2>
        <p class="text-gray-400 max-w-lg text-center mb-10 text-sm md:text-base leading-relaxed">{{ errorDescription }}</p>
        
        <div class="flex gap-4">
          <button @click="handleClose" class="px-6 py-3 bg-gray-800 hover:bg-gray-700 focus:ring-2 focus:ring-white text-white font-bold rounded-lg transition-colors border border-gray-700 outline-none">
            Voltar
          </button>
          <button @click="retryPlay" class="px-6 py-3 bg-primary hover:bg-blue-600 focus:ring-2 focus:ring-white text-white font-bold rounded-lg transition-colors flex items-center gap-2 outline-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            Tentar Novamente
          </button>
        </div>
      </div>
      
      <!-- Custom TV-Friendly UI Overlay -->
      <Transition name="fade">
        <div v-show="showControls" class="absolute inset-0 flex flex-col justify-between pointer-events-none">
          
          <!-- Top Bar -->
          <div class="p-6 md:px-12 md:py-8 flex justify-between items-start pointer-events-auto bg-gradient-to-b from-black/80 to-transparent">
            <!-- Left: Back Button Only -->
            <button 
              @click="handleClose()" 
              class="text-white hover:text-primary focus:text-white focus:bg-primary focus:outline-none transition-all p-3 md:p-4 rounded-full bg-black/40 backdrop-blur-md border border-white/10 shadow-lg" 
              aria-label="Fechar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>

            <!-- Right: Clock -->
            <div class="flex items-center gap-4 text-white drop-shadow-md mt-2">
              <span class="text-xl font-medium tracking-wider">{{ currentClock }}</span>
            </div>
          </div>

          <!-- Bottom Bar -->
          <div v-if="!hasError" class="p-6 md:px-12 md:py-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-auto">
            <div class="grid grid-cols-1 md:grid-cols-3 items-end w-full">
              
              <!-- Bottom Left: Info -->
              <div class="flex flex-col gap-2 w-full mb-6 md:mb-0">
                <div v-if="isLive" class="bg-[#ff4040] text-white text-xs font-bold px-2 py-0.5 rounded w-max uppercase tracking-wider mb-1">
                  Live
                </div>
                <h2 class="text-2xl md:text-3xl font-bold text-white drop-shadow-lg leading-tight">{{ title || 'Reproduzindo' }}</h2>
                <div class="text-white text-xl md:text-2xl font-medium mt-3 tracking-wider drop-shadow-md" v-if="!isLive">
                  {{ formatTime(currentTime) }}
                </div>
              </div>

              <!-- Bottom Center: Controls -->
              <div class="flex flex-col items-center justify-end w-full pb-2 mb-6 md:mb-0">
                <div class="flex items-center gap-8">
                  <button 
                    v-if="!isLive"
                    @click="seek(-10)" 
                    class="text-white hover:text-primary focus:outline-none transition-all p-2 hover:scale-110" 
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/></svg>
                  </button>

                  <button 
                    @click="togglePlay" 
                    class="text-white hover:scale-105 focus:outline-none transition-all p-5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 shadow-lg" 
                  >
                    <svg v-if="!isPlaying" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  </button>

                  <button 
                    v-if="!isLive"
                    @click="seek(10)" 
                    class="text-white hover:text-primary focus:outline-none transition-all p-2 hover:scale-110" 
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/></svg>
                  </button>
                </div>
              </div>

              <!-- Bottom Right: Secondary Actions -->
              <div class="flex items-center justify-end gap-6 w-full pb-6 relative">
                <button v-if="!isLive" class="text-white/80 hover:text-white transition-all hover:scale-110 p-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="14" x="3" y="5" rx="2" ry="2"/><path d="M7 15h4M15 15h2M7 11h2M13 11h4"/></svg>
                </button>

                <div class="relative">
                  <button
                    @click.stop="showRatioMenu = !showRatioMenu"
                    :class="['transition-all hover:scale-110 p-2', aspectRatio !== 'original' ? 'text-primary' : 'text-white/80 hover:text-white']"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="14" x="3" y="5" rx="2"/><path d="M5 9h4M9 9v4"/></svg>
                  </button>

                  <Transition name="fade">
                    <div v-show="showRatioMenu" class="absolute bottom-full right-0 mb-3 bg-black/90 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl overflow-hidden min-w-[110px] z-50">
                      <button
                        v-for="r in RATIOS"
                        :key="r.value"
                        @click.stop="selectAspectRatio(r.value)"
                        :class="['block w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors', aspectRatio === r.value ? 'bg-primary/20 text-primary' : 'text-gray-300 hover:bg-white/10 hover:text-white']"
                      >{{ r.label }}</button>
                    </div>
                  </Transition>
                </div>

                <button v-if="!isLive" class="text-white/80 hover:text-white transition-all hover:scale-110 p-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </button>
              </div>
            </div>

            <!-- Progress Bar (Hidden for Live TV, shown at the very bottom edge) -->
            <div v-if="!isLive" class="w-full mt-4 h-1.5 bg-gray-600/50 rounded-full cursor-pointer relative overflow-hidden" @click="seekTo">
              <div class="absolute left-0 h-full bg-primary transition-all" :style="{ width: duration ? (currentTime / duration) * 100 + '%' : '0%' }"></div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
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
