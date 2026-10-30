<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlaylistStore } from '../stores/playlist'
import { useFavoritesStore } from '../stores/favorites'
import { useHistoryStore } from '../stores/history'
import { cleanName } from '../utils/text'
import type { PlaylistItem } from '../types/m3u'
import VideoPlayer from '../components/VideoPlayer.vue'
import { TMDBService } from '../services/tmdb.service'
import type { TMDBMetadata } from '../lib/database'


import { db } from '../lib/database'

const store = usePlaylistStore()
const favoritesStore = useFavoritesStore()
const historyStore = useHistoryStore()
const route = useRoute()
const router = useRouter()

const item = ref<PlaylistItem | null>(null)
const errorMsg = ref('')
const isPlaying = ref(false)
const scrollContainer = ref<HTMLDivElement | null>(null)

function resetScroll() {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = 0
  }
}

watch(() => item.value?.id, () => {
  nextTick(() => {
    resetScroll()
    focusPlayButton()
  })
})

// Episodes are fetched on-demand from IDB — NOT from RAM.
// This avoids holding 200k PlaylistItems in memory at startup.
const episodes = ref<PlaylistItem[]>([])
const episodesLoading = ref(false)

async function loadEpisodes() {
  if (!item.value || item.value.type !== 'series') {
    episodes.value = []
    return
  }
  episodesLoading.value = true
  try {
    // Use serieKey stored on the PlaylistItem, or derive from cleanName
    const key = item.value.serieKey || cleanName(item.value.name).toLowerCase()
    episodes.value = await store.getSeriesEpisodes(key)
  } finally {
    episodesLoading.value = false
  }
}

const seasons = computed(() => {
  const map = new Map<number, PlaylistItem[]>()
  for (const ep of episodes.value) {
    const info = parseEpisodeInfo(ep.name)
    if (!map.has(info.season)) {
      map.set(info.season, [])
    }
    map.get(info.season)!.push(ep)
  }
  return Array.from(map.entries())
    .map(([season, eps]) => ({ 
      season, 
      episodes: eps.sort((a, b) => parseEpisodeInfo(a.name).episode - parseEpisodeInfo(b.name).episode) 
    }))
    .sort((a, b) => a.season - b.season)
})

const activeSeason = ref<number>(1)

const latestHistoryItem = computed(() => {
  if (!item.value) return null
  if (item.value.type === 'movie') {
    return historyStore.getProgress(item.value.id) || null
  }
  if (item.value.type === 'series') {
    const epIds = episodes.value.map(e => e.id)
    const seriesHistory = historyStore.historyItems.filter(h => epIds.includes(h.id))
    if (seriesHistory.length > 0) {
      return seriesHistory.sort((a, b) => b.watchedAt - a.watchedAt)[0]
    }
  }
  return null
})

const nextEpisodeToWatch = computed(() => {
  if (!item.value || item.value.type !== 'series') return null
  if (!latestHistoryItem.value) return seasons.value[0]?.episodes[0] || null

  const ep = episodes.value.find(e => e.id === latestHistoryItem.value!.id)
  if (!ep) return seasons.value[0]?.episodes[0] || null

  if (latestHistoryItem.value.duration > 0 && latestHistoryItem.value.currentTime >= latestHistoryItem.value.duration * 0.95) {
    const allEps = seasons.value.flatMap(s => s.episodes)
    const idx = allEps.findIndex(e => e.id === ep.id)
    if (idx !== -1 && idx + 1 < allEps.length) {
      return allEps[idx + 1]
    }
    return allEps[0]
  }
  return ep
})

const playButtonText = computed(() => {
  if (item.value?.type === 'series') {
    if (latestHistoryItem.value) {
      const isFinished = latestHistoryItem.value.duration > 0 && latestHistoryItem.value.currentTime >= latestHistoryItem.value.duration * 0.95
      if (isFinished) {
        const next = nextEpisodeToWatch.value
        if (next && next.id !== latestHistoryItem.value.id) {
          const info = parseEpisodeInfo(next.name)
          return `Próximo: T${info.season.toString().padStart(2, '0')}E${info.episode.toString().padStart(2, '0')}`
        }
        return 'Assistir de Novo'
      } else {
        const info = parseEpisodeInfo(nextEpisodeToWatch.value!.name)
        return `Continuar T${info.season.toString().padStart(2, '0')}E${info.episode.toString().padStart(2, '0')}`
      }
    }
    return 'Assistir Agora'
  } else if (item.value?.type === 'movie') {
    if (latestHistoryItem.value && latestHistoryItem.value.currentTime > 0) {
      const isFinished = latestHistoryItem.value.duration > 0 && latestHistoryItem.value.currentTime >= latestHistoryItem.value.duration * 0.95
      if (!isFinished) {
        return `Continuar de ${formatTime(latestHistoryItem.value.currentTime)}`
      }
      return 'Assistir de Novo'
    }
    return 'Assistir Agora'
  }
  return 'Assistir Agora'
})

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h${m}min`
  return `${m}min`
}

function getEpisodeProgress(epId: string) {
  const h = historyStore.getProgress(epId)
  if (!h || h.duration === 0) return 0
  return (h.currentTime / h.duration) * 100
}

const tmdbMetadata = ref<TMDBMetadata | null>(null)

const activePlaybackEpisode = ref<PlaylistItem | null>(null)

onMounted(async () => {
  if (!store.isLoaded) {
    router.push('/onboarding')
    return
  }
  await favoritesStore.loadFavorites()
  await historyStore.loadHistory()

  const id = route.params.id as string
  if (id) {
    const decodedId = decodeURIComponent(id)
    
    let found = await db.getPlaylistItemById(decodedId)
    
    if (found && found.type === 'series' && found.serieKey) {
      // If the resolved item is an episode, load the parent series metadata
      const seriesEntry = await db.getSeriesByKey(found.serieKey)
      if (seriesEntry) {
        found = {
          id: seriesEntry.id,
          name: seriesEntry.displayName,
          url: '',
          group: seriesEntry.group,
          logo: seriesEntry.logo || found.logo,
          type: 'series' as const,
          serieKey: seriesEntry.serieKey
        }
      }
    } else if (!found) {
      const foundSeries = await db.getSeriesById(decodedId)
      if (foundSeries) {
        found = {
          id: foundSeries.id,
          name: foundSeries.displayName,
          url: '',          // will be overridden by episode playback
          group: foundSeries.group,
          logo: foundSeries.logo,
          type: 'series' as const,
          serieKey: foundSeries.serieKey
        }
      }
    }

    if (found) {
      item.value = found as PlaylistItem
      if (found.type === 'movie' || found.type === 'series') {
        TMDBService.getMetadata(found.id, found.name, found.type).then(meta => {
          tmdbMetadata.value = meta
        })
      }
      if (found.type === 'series') {
        await loadEpisodes()
        if (seasons.value.length > 0) {
          const next = nextEpisodeToWatch.value
          if (next) {
            const info = parseEpisodeInfo(next.name)
            activeSeason.value = info.season
          } else {
            activeSeason.value = seasons.value[0].season
          }
        }
      }
      nextTick(() => focusPlayButton())
    } else {
      errorMsg.value = 'Item não encontrado.'
    }
  }
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

function goBack() {
  router.back()
}

function startPlayback() {
  if (item.value?.type === 'series') {
    const ep = nextEpisodeToWatch.value
    if (ep) {
      activePlaybackEpisode.value = ep
      const info = parseEpisodeInfo(ep.name)
      activeSeason.value = info.season
    }
  } else {
    activePlaybackEpisode.value = null
  }
  isPlaying.value = true
}

function extractYear(name: string): string | null {
  const match = name.match(/\((\d{4})\)/) || name.match(/\s(\d{4})$/)
  return match ? match[1] : null
}

function parseEpisodeInfo(name: string) {
  const s0e0 = name.match(/S(\d{1,2})\s*E(\d{1,3})/i)
  if (s0e0) return { season: parseInt(s0e0[1]), episode: parseInt(s0e0[2]) }

  const dxdy = name.match(/(\d{1,2})x(\d{1,3})/i)
  if (dxdy) return { season: parseInt(dxdy[1]), episode: parseInt(dxdy[2]) }

  const ep = name.match(/Ep\.?\s*(\d+)/i)
  if (ep) return { season: 1, episode: parseInt(ep[1]) }

  return { season: 1, episode: 0 }
}

function playEpisode(ep: PlaylistItem) {
  activePlaybackEpisode.value = ep
  const info = parseEpisodeInfo(ep.name)
  activeSeason.value = info.season
  isPlaying.value = true
}

async function onPlayerClose() {
  isPlaying.value = false
  activePlaybackEpisode.value = null
  await historyStore.loadHistory()
}

function focusPlayButton() {
  const playBtn = document.getElementById('btn-play')
  if (playBtn) playBtn.focus()
}

function handleKeydown(e: KeyboardEvent) {
  if (isPlaying.value) return // Let VideoPlayer handle it
  
  const active = document.activeElement as HTMLElement
  if (!active || !active.id) return

  const id = active.id
  
  // Handle "Assistir" and "Favoritar" buttons
  if (id === 'btn-play' || id === 'btn-fav') {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const firstSeason = document.getElementById('btn-season-0')
      if (firstSeason) firstSeason.focus()
    } else if (e.key === 'ArrowRight' && id === 'btn-play') {
      e.preventDefault()
      const favBtn = document.getElementById('btn-fav')
      if (favBtn) favBtn.focus()
    } else if (e.key === 'ArrowLeft' && id === 'btn-fav') {
      e.preventDefault()
      const playBtn = document.getElementById('btn-play')
      if (playBtn) playBtn.focus()
    }
  }
  // Handle Seasons
  else if (id.startsWith('btn-season-')) {
    const idx = parseInt(id.replace('btn-season-', ''))
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusPlayButton()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const firstEp = document.getElementById('btn-ep-0')
      if (firstEp) firstEp.focus()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      const nextSeason = document.getElementById(`btn-season-${idx + 1}`)
      if (nextSeason) nextSeason.focus()
    } else if (e.key === 'ArrowLeft') {
      if (idx > 0) {
        e.preventDefault()
        const prevSeason = document.getElementById(`btn-season-${idx - 1}`)
        if (prevSeason) prevSeason.focus()
      }
    }
  }
  // Handle Episodes
  else if (id.startsWith('btn-ep-')) {
    const idx = parseInt(id.replace('btn-ep-', ''))
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (idx < 6) { // First row
        const seasonIdx = seasons.value.findIndex(s => s.season === activeSeason.value)
        const seasonBtn = document.getElementById(`btn-season-${Math.max(0, seasonIdx)}`)
        if (seasonBtn) seasonBtn.focus()
      } else {
        const prevRow = document.getElementById(`btn-ep-${idx - 6}`)
        if (prevRow) prevRow.focus()
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextRow = document.getElementById(`btn-ep-${idx + 6}`)
      if (nextRow) nextRow.focus()
    } else if (e.key === 'ArrowLeft') {
      if (idx % 6 !== 0) {
        e.preventDefault()
        const prevCol = document.getElementById(`btn-ep-${idx - 1}`)
        if (prevCol) prevCol.focus()
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (idx % 6 !== 5) {
        const nextCol = document.getElementById(`btn-ep-${idx + 1}`)
        if (nextCol) nextCol.focus()
      }
    }
    
    // Ensure scrolled into view
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      setTimeout(() => {
        const newActive = document.activeElement
        if (newActive && scrollContainer.value) {
          newActive.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 50)
    }
  }
}
</script>

<template>
  <div class="flex h-full bg-[#0f171e]">
    <!-- Main Details Area -->
    <div v-if="item" class="flex-1 relative flex flex-col overflow-hidden">
      
      <!-- Back button overlay -->
      <button 
        @click="goBack"
        class="absolute top-6 left-6 z-50 flex items-center justify-center gap-2 px-4 py-2 bg-black/40 hover:bg-black/70 border border-white/10 rounded-full text-white backdrop-blur-md transition-all font-medium text-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Voltar
      </button>

      <!-- Background Image -->
      <div class="absolute inset-0 z-0">
        <img 
          v-if="(tmdbMetadata && tmdbMetadata.backdrop_url) || item.logo" 
          :src="(tmdbMetadata && tmdbMetadata.backdrop_url) || item.logo" 
          class="w-full h-full object-cover opacity-60 object-top md:object-right-top" 
          @error="(e) => (e.target as HTMLImageElement).style.display='none'"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-[#0f171e] via-[#0f171e]/70 to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-r from-[#0f171e] via-[#0f171e]/40 to-transparent w-full md:w-2/3"></div>
      </div>

      <!-- Content -->
      <div ref="scrollContainer" class="relative z-10 flex-1 flex flex-col w-full overflow-y-auto scrollbar-thin">
        <div :class="[
          'pb-12 px-6 md:px-20 w-full flex flex-col',
          item.type === 'series' ? 'pt-[20vh] md:pt-[30vh]' : 'pt-[45vh] md:pt-[55vh]'
        ]">
          
          <div class="max-w-5xl">
            <span class="text-primary text-sm font-bold tracking-[0.2em] uppercase mb-4 drop-shadow-md block">
              {{ item.type === 'movie' ? 'Filme' : (item.type === 'series' ? 'Série' : 'Ao Vivo') }}
            </span>
            
            <h1 class="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-4 drop-shadow-lg">
              {{ cleanName(item.name) }}
            </h1>
            
            <div class="flex items-center gap-4 text-gray-300 text-sm md:text-base mb-8 font-medium">
              <span v-if="extractYear(item.name)" class="text-gray-200">
                Lançamento: {{ extractYear(item.name) }}
              </span>
              <span class="bg-gray-800/80 px-3 py-1 rounded">{{ item.group }}</span>
              <span v-if="item.type === 'series'" class="text-gray-400 border border-gray-600 px-2 py-0.5 rounded text-xs uppercase tracking-wider">
                {{ episodes.length }} Episódio(s)
              </span>
            </div>

            <p class="text-gray-300 text-base md:text-lg max-w-3xl mb-6 leading-relaxed line-clamp-5">
              {{ (tmdbMetadata && tmdbMetadata.overview) || 'Assista agora a este conteúdo em alta qualidade. Detalhes adicionais sobre a sinopse não estão disponíveis no momento através do provedor.' }}
            </p>

            <div v-if="item.type === 'movie' && latestHistoryItem && latestHistoryItem.currentTime > 0" class="w-full max-w-sm mb-6 bg-gray-800 rounded-full h-1.5 overflow-hidden border border-gray-700/50">
              <div class="h-full bg-primary transition-all duration-500" :style="{ width: (latestHistoryItem.currentTime / latestHistoryItem.duration) * 100 + '%' }"></div>
            </div>

            <div class="flex items-center gap-4 mb-12">
              <button 
                id="btn-play"
                @click="startPlayback"
                class="bg-primary hover:bg-blue-600 focus:bg-white focus:text-black focus:scale-105 text-white flex items-center justify-center gap-3 px-8 py-4 rounded-lg font-bold transition-all shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 text-lg min-w-[240px]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                {{ playButtonText }}
              </button>
              <button 
                id="btn-fav"
                @click="favoritesStore.toggleFavorite(item.id)"
                :class="['flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-bold transition-all border border-white/20 hover:scale-105 focus:scale-105 focus:border-primary active:scale-95 text-lg', favoritesStore.isFavorite(item.id) ? 'bg-white text-black' : 'bg-black/40 text-white hover:bg-white/20 focus:bg-white focus:text-black']"
              >
                <svg v-if="favoritesStore.isFavorite(item.id)" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                {{ favoritesStore.isFavorite(item.id) ? 'Favorito' : 'Favoritar' }}
              </button>
            </div>
          </div>

          <!-- Seasons and Episodes -->
          <div v-if="item.type === 'series' && seasons.length > 0" class="mt-4 w-full">
            <!-- Season Selector -->
            <div class="flex gap-4 overflow-x-auto no-scrollbar mb-6 pb-2">
              <button 
                v-for="(s, index) in seasons" 
                :key="s.season"
                :id="'btn-season-' + index"
                @click="activeSeason = s.season"
                :class="[
                  'px-6 py-2 rounded-full font-bold transition-all whitespace-nowrap focus:scale-105 focus:ring-4 focus:ring-primary',
                  activeSeason === s.season ? 'bg-white text-black' : 'bg-gray-800/60 text-gray-400 hover:bg-gray-700 hover:text-white focus:bg-white focus:text-black'
                ]"
              >
                Temporada {{ s.season }}
              </button>
            </div>

            <!-- Episodes Grid -->
            <div class="grid grid-cols-6 gap-3 md:gap-4 pb-20">
              <div 
                v-for="(ep, index) in seasons.find(s => s.season === activeSeason)?.episodes"
                :key="ep.id"
                :id="'btn-ep-' + index"
                tabindex="0"
                @click="playEpisode(ep)"
                class="group cursor-pointer focus:outline-none focus:ring-4 focus:ring-primary bg-gray-900/60 border border-gray-800 hover:border-primary/50 rounded overflow-hidden flex flex-col transition-all hover:scale-[1.02] focus:scale-[1.05]"
              >
                <div class="aspect-[2/3] bg-gray-800 relative flex items-center justify-center">
                  <img v-if="ep.logo" :src="ep.logo" class="max-w-full max-h-full object-contain p-2 opacity-70 group-hover:opacity-100 transition-opacity" @error="(e) => (e.target as HTMLImageElement).style.display='none'" />
                  <div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <div class="bg-primary text-white rounded-full p-3 transform scale-75 group-hover:scale-100 transition-transform">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                  </div>
                  
                  <!-- PROGRESS BAR -->
                  <div v-if="getEpisodeProgress(ep.id) > 0 && getEpisodeProgress(ep.id) < 95" class="absolute bottom-0 left-0 h-1.5 bg-gray-900 w-full z-10 border-t border-gray-800/50">
                    <div class="h-full bg-primary transition-all duration-300" :style="{ width: getEpisodeProgress(ep.id) + '%' }"></div>
                  </div>
                  
                  <!-- CHECKMARK IF WATCHED -->
                  <div v-if="getEpisodeProgress(ep.id) >= 95" class="absolute top-2 right-2 z-10 bg-black/60 rounded-full p-1 text-primary backdrop-blur-sm border border-gray-700/50 shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  </div>
                </div>
                <div class="p-3">
                  <p class="text-sm text-gray-200 font-medium line-clamp-2">{{ ep.name.replace(cleanName(ep.name), '').replace(/^[\s-]+/, '') || `Episódio ${parseEpisodeInfo(ep.name).episode}` }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="errorMsg" class="flex-1 flex flex-col items-center justify-center text-white gap-4">
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-red-500"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <h2 class="text-2xl font-bold">Conteúdo indisponível</h2>
      <p class="text-gray-400">{{ errorMsg }}</p>
      <button @click="goBack" class="mt-4 px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded transition-colors">Voltar</button>
    </div>

    <!-- Loading State -->
    <div v-else class="flex-1 flex items-center justify-center">
      <div class="w-8 h-8 border-4 border-gray-700 border-t-primary rounded-full animate-spin"></div>
    </div>

    <!-- Player Overlay -->
    <VideoPlayer
      v-if="isPlaying && item"
      :id="activePlaybackEpisode ? activePlaybackEpisode.id : item.id"
      :url="activePlaybackEpisode ? activePlaybackEpisode.url : item.url"
      :title="activePlaybackEpisode ? activePlaybackEpisode.name : item.name"
      :poster="item.logo"
      @close="onPlayerClose"
      @error="errorMsg = $event"
    />
  </div>
</template>
