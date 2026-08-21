<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePlaylistStore } from '../stores/playlist'
import { useHistoryStore } from '../stores/history'
import { useFavoritesStore } from '../stores/favorites'
import { cleanName } from '../utils/text'
import type { PlaylistItem, SeriesEntry } from '../types/m3u'
import VideoPlayer from '../components/VideoPlayer.vue'
import { EPGService, type EPGProgram } from '../services/epg.service'
import { TMDBService } from '../services/tmdb.service'
import type { TMDBMetadata } from '../lib/database'
import ContentCard from '../components/ContentCard.vue'
import { db } from '../lib/database'

const store = usePlaylistStore()
const historyStore = useHistoryStore()
const favoritesStore = useFavoritesStore()
const router = useRouter()

// Type check helper
const isLiveChannel = (item: PlaylistItem | null) => {
  if (!item) return false
  return item.type === 'live'
}

const activeItem = ref<PlaylistItem | null>(null)
const errorMsg = ref('')

const activeCategory = ref('Home')

function setCategory(cat: string) {
  activeCategory.value = cat
  const el = document.querySelector('.overflow-y-auto')
  if (el) el.scrollTo({ top: 0, behavior: 'smooth' })
}

function withLogo<T extends { logo?: string }>(list: T[]): T[] {
  return list.filter(i => i.logo && i.logo.startsWith('http'))
}

const categoryContent = ref<{ live: PlaylistItem[], movies: PlaylistItem[], series: PlaylistItem[] } | null>(null)

// ── Horizontal rows ────────────────────────────────────────────
const recentMovies = ref<PlaylistItem[]>([])
const recentSeries = ref<SeriesEntry[]>([])
const favoriteItems = ref<(PlaylistItem | SeriesEntry)[]>([])
const movieRows = ref<{name: string, items: PlaylistItem[]}[]>([])
const seriesRows = ref<{name: string, items: SeriesEntry[]}[]>([])

// ── Hero carousel ──────────────────────────────────────────────
const heroIndex = ref(0)
let heroTimer: ReturnType<typeof setInterval> | null = null

const heroItems = ref<PlaylistItem[]>([])

async function loadHomeData() {
  const [dbRecentMovies, dbRecentSeries, topMovieCats, topSeriesCats] = await Promise.all([
    db.getRecentItems('movie', 60),
    db.getRecentSeries(60),
    db.getTopCategories('movie', 4),
    db.getTopCategories('series', 3)
  ])
  
  recentMovies.value = dbRecentMovies
  recentSeries.value = dbRecentSeries
  
  movieRows.value = topMovieCats
  seriesRows.value = topSeriesCats.map(cat => ({
    name: cat.name,
    items: cat.items as unknown as SeriesEntry[] // Just passing the type through
  }))

  // Favorites
  const ids = favoritesStore.favoriteIds
  const favItems: (PlaylistItem | SeriesEntry)[] = []
  for (const id of ids) {
    let item: any = await db.getPlaylistItemById(id)
    if (!item) item = await db.getSeriesById(id)
    if (item) favItems.push(item)
  }
  favoriteItems.value = favItems
  
  const moviesWithLogo = withLogo(dbRecentMovies).slice(0, 6)
  const seriesEntries = withLogo(dbRecentSeries).slice(0, 6)
  
  const seriesItems: PlaylistItem[] = seriesEntries.map(s => ({
    id: s.id,
    name: s.displayName,
    url: '',
    group: s.group,
    logo: s.logo,
    type: 'series',
    serieKey: s.serieKey
  }))

  const mixed: PlaylistItem[] = []
  const max = Math.max(moviesWithLogo.length, seriesItems.length)
  for (let i = 0; i < max; i++) {
    if (moviesWithLogo[i]) mixed.push(moviesWithLogo[i])
    if (seriesItems[i]) mixed.push(seriesItems[i])
  }
  heroItems.value = mixed.slice(0, 8)
  categoryContent.value = null
}

async function loadCategoryData(cat: string) {
  let keywords: string[] = []
  if (cat === 'Esportes') keywords = ['esporte', 'sport', 'futebol', 'premiere', 'combate', 'espn', 'fox']
  else if (cat === 'News') keywords = ['news', 'notícia', 'noticia', 'jornal', 'bandnews', 'globonews', 'cnn']
  else if (cat === 'Infantil') keywords = ['infantil', 'kids', 'criança', 'desenho', 'cartoon', 'nickelodeon', 'gloob', 'boomerang', 'discovery kids', 'disney junior']

  // To keep it fast, we'll fetch a larger set and filter by keywords in memory.
  // Alternatively we could add a specialized search function in sqlite.ts.
  const [allLive, allMovies] = await Promise.all([
    db.getPlaylistItems('live', 2000, 0),
    (cat === 'Esportes' || cat === 'News') ? [] : db.getPlaylistItems('movie', 2000, 0)
  ])

  const match = (item: PlaylistItem | SeriesEntry) => {
    const itemName = 'name' in item ? item.name : item.displayName
    const text = (itemName + ' ' + (item.group || '')).toLowerCase()
    return keywords.some(k => text.includes(k))
  }

  const live = withLogo(allLive.filter(match)).slice(0, 50)
  const movies = (cat === 'Esportes' || cat === 'News') ? [] : withLogo(allMovies.filter(match)).slice(0, 50)
  const series = (cat === 'Esportes' || cat === 'News') ? [] : withLogo(store.uniqueSeries.filter(match)).slice(0, 50) as unknown as PlaylistItem[]

  categoryContent.value = { live, movies, series }
  heroItems.value = live.slice(0, 6)
}

const hoveredItem = ref<PlaylistItem | null>(null)

const isPageLoading = ref(true)

watch(activeCategory, async (newCat) => {
  hoveredItem.value = null
  heroIndex.value = 0
  stopHeroTimer()
  
  isPageLoading.value = true
  
  // Force a minimum display time for the preloader to avoid UI flashes
  const minDelay = new Promise(r => setTimeout(r, 400))
  
  const loadTask = newCat === 'Home' 
    ? loadHomeData().then(startHeroTimer)
    : loadCategoryData(newCat)

  await Promise.all([loadTask, minDelay])
  
  isPageLoading.value = false
}, { immediate: true })

function setCategoryHovered(item: PlaylistItem) {
  if (activeCategory.value !== 'Home') {
    hoveredItem.value = item
  }
}

const currentHero = computed(() => {
  if (activeCategory.value !== 'Home' && hoveredItem.value) {
    return hoveredItem.value
  }
  return heroItems.value[heroIndex.value] ?? null
})

function nextHero() {
  if (heroItems.value.length > 1)
    heroIndex.value = (heroIndex.value + 1) % heroItems.value.length
}
function prevHero() {
  if (heroItems.value.length > 1)
    heroIndex.value = (heroIndex.value - 1 + heroItems.value.length) % heroItems.value.length
}
function goHero(i: number) { heroIndex.value = i }

function startHeroTimer() {
  if (heroTimer) clearInterval(heroTimer)
  heroTimer = setInterval(nextHero, 6000)
}
// Stop hero timer function definition
function stopHeroTimer() {
  if (heroTimer) { clearInterval(heroTimer); heroTimer = null }
}

// EPG watch for Hero Banner
const heroProgram = ref<EPGProgram | null>(null)
const tmdbHeroMetadata = ref<TMDBMetadata | null>(null)
const heroMetaCache = ref<Record<string, TMDBMetadata>>({})

watch(currentHero, async (newVal) => {
  tmdbHeroMetadata.value = null
  if (newVal) {
    if (isLiveChannel(newVal)) {
      heroProgram.value = await EPGService.getCurrentProgram(newVal.id, newVal.name, newVal.group, newVal.epgId)
    } else {
      heroProgram.value = null
      const type = newVal.type === 'movie' ? 'movie' : 'series'
      const cached = heroMetaCache.value[newVal.id]
      if (cached) {
        tmdbHeroMetadata.value = cached
      } else {
        const meta = await TMDBService.getMetadata(newVal.id, newVal.name, type)
        heroMetaCache.value[newVal.id] = meta
        tmdbHeroMetadata.value = meta
      }
    }
  } else {
    heroProgram.value = null
  }
}, { immediate: true })

// Preload TMDB wallpapers for all hero items so the banner doesn't flash
// with the poster/logo while auto-rotating.
// Sequential loading to avoid saturating Smart TV Wi-Fi and TMDB rate limits.
async function preloadHeroMetadata() {
  const items = heroItems.value
  for (const item of items) {
    if (isLiveChannel(item) || heroMetaCache.value[item.id]) continue
    try {
      const type = item.type === 'movie' ? 'movie' : 'series'
      const meta = await TMDBService.getMetadata(item.id, item.name, type)
      heroMetaCache.value[item.id] = meta
      if (currentHero.value?.id === item.id) {
        tmdbHeroMetadata.value = meta
      }
    } catch {
      // Skip failed items silently — TMDB service already has its own fallback
    }
  }
}

// Async EPG map for grid items
const channelEPGs = ref<Record<string, EPGProgram>>({})

// Sequential EPG loading capped at 20 channels to prevent IDB contention on TVs
async function loadCategoryEPGs(channels: PlaylistItem[]) {
  const epgs: Record<string, EPGProgram> = {}
  const capped = channels.slice(0, 20)
  
  for (const c of capped) {
    try {
      const prog = await EPGService.getCurrentProgram(c.id, c.name, c.group, c.epgId)
      if (prog) {
        epgs[c.id] = prog
      }
    } catch {
      // Skip failed lookups silently
    }
  }
  channelEPGs.value = epgs
}

// Debounced watcher prevents rapid-fire EPG loads on fast category switching
let epgDebounceTimer: ReturnType<typeof setTimeout> | null = null

watch(categoryContent, (newVal) => {
  if (epgDebounceTimer) clearTimeout(epgDebounceTimer)
  
  if (newVal && newVal.live.length > 0) {
    epgDebounceTimer = setTimeout(() => {
      loadCategoryEPGs(newVal.live)
    }, 250)
  } else {
    channelEPGs.value = {}
  }
}, { immediate: true })

// Rows logic moved to loadHomeData()
function extractYear(name?: string): string | null {
  if (!name) return null
  const match = name.match(/\((\d{4})\)/) || name.match(/\s(\d{4})$/)
  return match ? match[1] : null
}

/** Scroll a named row left or right */
function scrollRow(id: string, dir: 'left' | 'right') {
  const el = document.getElementById(id)
  if (el) el.scrollBy({ left: dir === 'right' ? 820 : -820, behavior: 'smooth' })
}

function play(item: PlaylistItem | SeriesEntry) {
  const itemType = 'type' in item ? item.type : undefined
  if (itemType === 'movie' || itemType === 'series' || ('serieKey' in item && item.serieKey)) {
    router.push('/details/' + encodeURIComponent(item.id))
  } else {
    errorMsg.value = ''
    activeItem.value = item as PlaylistItem
  }
}

function clearData() {
  store.clearPlaylist()
  router.push('/onboarding')
}

function formatTime(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function getProgress(prog: EPGProgram) {
  const now = new Date().getTime()
  const start = prog.startTime.getTime()
  const end = prog.endTime.getTime()
  const percent = ((now - start) / (end - start)) * 100
  return Math.min(Math.max(percent, 0), 100)
}

onMounted(async () => {
  if (!store.isLoaded) {
    router.push('/onboarding')
    return
  }
  isPageLoading.value = true
  await historyStore.loadHistory()
  await favoritesStore.loadFavorites()
  preloadHeroMetadata()
  if (activeCategory.value === 'Home') {
    startHeroTimer()
  }
  isPageLoading.value = false
})

onUnmounted(() => stopHeroTimer())
</script>

<template>
  <div v-if="store.isLoaded" class="h-full overflow-y-auto bg-[#0f171e] scrollbar-thin relative">

    <!-- Loading State -->
    <div v-if="isPageLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-[#0f171e] z-50">
      <div class="w-12 h-12 border-4 border-gray-700 border-t-primary rounded-full animate-spin mb-4"></div>
      <p class="text-gray-400 font-medium">Carregando catálogo...</p>
    </div>

    <!-- ══════════════════════════════════════════════════
         TOP MENU BAR
    ══════════════════════════════════════════════════ -->
    <header class="absolute top-0 left-0 right-0 z-50 flex items-center gap-8 px-10 md:px-16 py-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent pointer-events-none">
      <div class="pointer-events-auto flex items-center gap-8">
        <button @click="setCategory('Home')" :class="['font-bold text-lg transition-colors tracking-wide drop-shadow-lg', activeCategory === 'Home' ? 'text-white' : 'text-gray-400 hover:text-white']">Home</button>
        <button @click="setCategory('Esportes')" :class="['font-medium text-base transition-colors drop-shadow-lg', activeCategory === 'Esportes' ? 'text-white font-bold' : 'text-gray-300 hover:text-white']">Esportes</button>
        <button @click="setCategory('News')" :class="['font-medium text-base transition-colors drop-shadow-lg', activeCategory === 'News' ? 'text-white font-bold' : 'text-gray-300 hover:text-white']">News</button>
        <button @click="setCategory('Infantil')" :class="['font-medium text-base transition-colors drop-shadow-lg', activeCategory === 'Infantil' ? 'text-white font-bold' : 'text-gray-300 hover:text-white']">Infantil</button>
      </div>
    </header>

    <!-- ══════════════════════════════════════════════════
         HERO CAROUSEL
    ══════════════════════════════════════════════════ -->
    <section
      v-if="currentHero"
      class="relative w-full h-[60vh] min-h-[550px] select-none overflow-hidden"
      @mouseenter="stopHeroTimer"
      @mouseleave="startHeroTimer"
    >
      <!-- Background with transition -->
      <Transition name="hero-fade" mode="out-in">
        <div :key="currentHero.id" class="absolute inset-0 bg-[#0f171e]">
          
          <!-- Image Container without heavy masks -->
          <div class="absolute inset-0 w-full h-full">
            <img
              :src="(tmdbHeroMetadata && tmdbHeroMetadata.backdrop_url) || currentHero.logo"
              :class="['w-full h-full hero-zoom opacity-80', (isLiveChannel(currentHero) && !(tmdbHeroMetadata && tmdbHeroMetadata.backdrop_url)) ? 'object-contain p-12' : 'object-cover object-[75%_center] md:object-right-top']"
              @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
            />
          </div>

          <!-- Smooth Overlays for text contrast -->
          <div class="absolute inset-0 bg-gradient-to-r from-[#0f171e] via-[#0f171e]/70 to-transparent w-full md:w-[70%] z-0 pointer-events-none"></div>
          <div class="absolute inset-0 bg-gradient-to-t from-[#0f171e] via-[#0f171e]/40 to-transparent z-0 pointer-events-none"></div>
        </div>
      </Transition>

      <!-- Text content -->
      <Transition name="hero-content" mode="out-in">
        <div :key="currentHero.id" class="relative z-20 h-full flex flex-col justify-end pl-16 md:pl-20 pr-10 md:pr-16 pb-16 max-w-4xl">
          <div class="flex items-center gap-2 mb-3">
            <span class="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider shadow-lg shadow-red-600/30" v-if="isLiveChannel(currentHero)">AO VIVO</span>
            <span class="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider shadow-lg shadow-primary/30" v-else>DESTAQUE</span>
            <span class="text-gray-400 text-xs font-medium">{{ currentHero.group }}</span>
          </div>

          <h1 class="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight drop-shadow-2xl max-w-3xl">
            {{ cleanName(currentHero.name || '') }}
          </h1>

          <!-- EPG Program details for Live Channel -->
          <template v-if="isLiveChannel(currentHero) && heroProgram">
            <div class="text-primary font-semibold text-lg drop-shadow mb-1">{{ heroProgram.title }}</div>
            <div class="flex items-center gap-3 text-sm text-gray-400 mb-2 font-medium">
              <span class="bg-black/40 px-2 py-0.5 rounded text-gray-300 border border-gray-700/50">
                {{ formatTime(heroProgram.startTime) }} - {{ formatTime(heroProgram.endTime) }}
              </span>
              <span class="text-xs uppercase tracking-wider text-green-400 font-bold bg-green-400/10 px-2 py-0.5 rounded">Agora</span>
            </div>
            <p class="text-gray-400 text-sm line-clamp-2 leading-relaxed max-w-xl mb-4">{{ heroProgram.description }}</p>
            
            <div class="flex items-center gap-3 w-full max-w-md mb-6">
              <span class="text-xs text-gray-500 font-medium w-10 text-right">{{ formatTime(heroProgram.startTime) }}</span>
              <div class="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div class="bg-primary h-full rounded-full transition-all duration-1000" :style="{ width: getProgress(heroProgram) + '%' }"></div>
              </div>
              <span class="text-xs text-gray-500 font-medium w-10">{{ formatTime(heroProgram.endTime) }}</span>
            </div>
          </template>

          <template v-else>
            <div class="flex items-center gap-3 mb-4 mt-2">
              <span v-if="extractYear(currentHero.name)" class="text-gray-400 text-[10px] font-bold tracking-widest uppercase">Lançamento: {{ extractYear(currentHero.name) }}</span>
            </div>
            <p class="text-gray-300 text-sm md:text-base line-clamp-3 leading-relaxed max-w-2xl mb-8 drop-shadow-md">
              {{ (tmdbHeroMetadata && tmdbHeroMetadata.overview) || 'Selecione para assistir agora.' }}
            </p>
          </template>

          <div class="flex gap-4">
            <button
              @click="play(currentHero)"
              class="flex items-center gap-2.5 bg-white text-black px-8 py-3.5 rounded-full font-bold text-sm hover:bg-gray-100 hover:scale-105 transition-all duration-200 shadow-2xl"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Assistir agora
            </button>
            <button
              v-if="!isLiveChannel(currentHero)"
              class="flex items-center gap-2 bg-white/10 text-white px-7 py-3.5 rounded-full font-bold text-sm hover:bg-white/20 hover:scale-105 transition-all duration-200 backdrop-blur-sm border border-white/20"
              @click="router.push(currentHero.type === 'movie' ? '/movies' : '/series')"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              Ver mais
            </button>
          </div>
        </div>
      </Transition>

      <!-- Arrows -->
      <button
        v-if="heroItems.length > 1 && activeCategory === 'Home'"
        @click="prevHero"
        class="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm border border-white/10 hover:border-white/30 transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <button
        v-if="heroItems.length > 1 && activeCategory === 'Home'"
        @click="nextHero"
        class="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm border border-white/10 hover:border-white/30 transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>

      <!-- Dots -->
      <div v-if="heroItems.length > 1 && activeCategory === 'Home'" class="absolute bottom-6 right-8 z-20 flex gap-2 items-center">
        <button
          v-for="(_, i) in heroItems"
          :key="i"
          @click="goHero(i)"
          :class="['rounded-full transition-all duration-300', i === heroIndex ? 'bg-white w-6 h-2' : 'bg-white/30 hover:bg-white/50 w-2 h-2']"
        />
      </div>
    </section>

    <!-- ══════════════════════════════════════════════════
         CONTENT ROWS
    ══════════════════════════════════════════════════ -->
    <div class="mt-6 relative z-10 pb-16 space-y-10 px-4 md:px-8">

      <!-- CATEGORY VIEW -->
      <div v-if="activeCategory !== 'Home' && categoryContent" class="space-y-10">
        <h2 class="text-2xl md:text-3xl font-extrabold text-white px-2 mt-4 drop-shadow-lg capitalize">{{ activeCategory }}</h2>
        
        <template v-if="categoryContent.live.length > 0">
          <div>
            <div class="flex items-center justify-between mb-4 px-1">
              <h2 class="text-base md:text-lg font-bold text-gray-100">Ao Vivo</h2>
            </div>
            
            <div class="grid grid-cols-6 gap-4 px-1">
              <ContentCard
                v-for="item in categoryContent.live"
                :key="item.id"
                :item="item"
                :is-portrait="false"
                :show-title="true"
                @play="play(item)"
                @mouseenter="setCategoryHovered(item)"
                @focus="setCategoryHovered(item)"
              />
            </div>
          </div>
        </template>

        <template v-if="categoryContent.movies.length > 0">
          <div>
            <div class="flex items-center justify-between mb-4 px-1">
              <h2 class="text-base md:text-lg font-bold text-gray-100">Filmes</h2>
            </div>
            <div class="grid grid-cols-8 gap-4 px-1">
              <ContentCard
                v-for="item in categoryContent.movies" 
                :key="item.id"
                :item="item"
                :is-portrait="true"
                :show-title="true"
                @play="play(item)"
              />
            </div>
          </div>
        </template>

        <template v-if="categoryContent.series.length > 0">
          <div>
            <div class="flex items-center justify-between mb-4 px-1">
              <h2 class="text-base md:text-lg font-bold text-gray-100">Séries</h2>
            </div>
            <div class="grid grid-cols-8 gap-4 px-1">
              <ContentCard
                v-for="item in categoryContent.series" 
                :key="item.id"
                :item="item"
                :is-portrait="true"
                :show-title="true"
                @play="play(item)"
              />
            </div>
          </div>
        </template>

        <div v-if="categoryContent.live.length === 0 && categoryContent.movies.length === 0 && categoryContent.series.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-4"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <p>Nenhum conteúdo encontrado para "{{ activeCategory }}".</p>
        </div>
      </div>

      <!-- HOME VIEW (Default) -->
      <div v-show="activeCategory === 'Home'" class="space-y-10">



      <!-- Filmes Recentes -->
      <template v-if="recentMovies.length > 0">
        <div>
          <div class="flex items-center justify-between mb-3 px-1">
            <h2 class="text-base md:text-lg font-bold text-gray-100"><span class="text-primary font-extrabold text-sm tracking-wider mr-2"></span>Filmes Recentes</h2>
            <button @click="router.push('/movies')" class="text-xs text-gray-500 hover:text-primary transition-colors flex items-center gap-1 font-medium">Ver todos <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
          </div>
          <div class="relative">
            <button @click="scrollRow('row-recent-movies','left')" class="row-arrow row-arrow-left"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
            <div id="row-recent-movies" class="flex gap-3 overflow-x-auto no-scrollbar snap-x px-1" v-horizontal-scroll>
              <ContentCard
                v-for="item in recentMovies" 
                :key="item.id"
                :item="item"
                :is-portrait="true"
                :show-title="false"
                class="card-portrait"
                @play="play(item)"
              />
            </div>
            <button @click="scrollRow('row-recent-movies','right')" class="row-arrow row-arrow-right"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
          </div>
        </div>
      </template>



      <!-- Séries Recentes -->
      <template v-if="recentSeries.length > 0">
        <div>
          <div class="flex items-center justify-between mb-3 px-1">
            <h2 class="text-base md:text-lg font-bold text-gray-100">
              <span class="text-primary font-extrabold text-sm tracking-wider mr-2"></span>Séries Recentes
            </h2>
            <button @click="router.push('/series')" class="text-xs text-gray-500 hover:text-primary transition-colors flex items-center gap-1 font-medium">
              Ver todas <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
          <div class="relative group/row">
            <button @click="scrollRow('row-recent-series', 'left')" class="row-arrow row-arrow-left"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
            <div id="row-recent-series" class="flex gap-3 overflow-x-auto no-scrollbar snap-x px-1" v-horizontal-scroll>
              <ContentCard
                v-for="item in recentSeries" 
                :key="item.id"
                :item="item"
                :is-portrait="true"
                :show-title="false"
                class="card-portrait"
                @play="play(item)"
              />
            </div>
            <button @click="scrollRow('row-recent-series', 'right')" class="row-arrow row-arrow-right"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
          </div>
        </div>
      </template>


      <!-- Continuar Assistindo -->
      <template v-if="historyStore.activelyWatching.length > 0">
        <div>
          <div class="flex items-center justify-between mb-3 px-1">
            <h2 class="text-base md:text-lg font-bold text-gray-100"><span class="text-primary font-extrabold text-sm tracking-wider mr-2">▶</span>Continuar Assistindo</h2>
          </div>
          <div class="relative group/row">
            <button @click="scrollRow('row-continue','left')" class="row-arrow row-arrow-left"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
            <div id="row-continue" class="flex gap-3 overflow-x-auto no-scrollbar snap-x px-1" v-horizontal-scroll>
              <ContentCard
                v-for="item in historyStore.activelyWatching" 
                :key="item.id"
                :item="item.metadata"
                :is-portrait="true"
                :show-title="false"
                :progress="historyStore.getProgressPercentage(item.id)"
                class="card-portrait"
                @play="play(item.metadata)"
              />
            </div>
            <button @click="scrollRow('row-continue','right')" class="row-arrow row-arrow-right"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
          </div>
        </div>
      </template>

      <!-- Meus Favoritos -->
      <template v-if="favoriteItems.length > 0">
        <div>
          <div class="flex items-center justify-between mb-3 px-1">
            <h2 class="text-base md:text-lg font-bold text-gray-100"><span class="text-primary font-extrabold text-sm tracking-wider mr-2">❤️</span>Meus Favoritos</h2>
          </div>
          <div class="relative group/row">
            <button @click="scrollRow('row-favorites','left')" class="row-arrow row-arrow-left"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
            <div id="row-favorites" class="flex gap-3 overflow-x-auto no-scrollbar snap-x px-1" v-horizontal-scroll>
              <ContentCard
                v-for="item in favoriteItems" 
                :key="item.id"
                :item="item"
                :is-portrait="true"
                :show-title="false"
                class="card-portrait"
                @play="play(item)"
              />
            </div>
            <button @click="scrollRow('row-favorites','right')" class="row-arrow row-arrow-right"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
          </div>
        </div>
      </template>

      <!-- Movie category rows -->
      <template v-for="row in movieRows" :key="'mr-' + row.name">
        <div>
          <div class="flex items-center justify-between mb-3 px-1">
            <h2 class="text-base md:text-lg font-bold text-gray-100">
              <span class="text-primary font-extrabold text-sm tracking-wider mr-2"></span>{{ row.name }}
            </h2>
            <button @click="router.push('/movies')" class="text-xs text-gray-500 hover:text-primary transition-colors flex items-center gap-1 font-medium">
              Ver todos <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
          <div class="relative group/row">
            <button @click="scrollRow('row-movies-' + row.name, 'left')" class="row-arrow row-arrow-left"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
            <div :id="'row-movies-' + row.name" class="flex gap-3 overflow-x-auto no-scrollbar snap-x px-1" v-horizontal-scroll>
              <ContentCard
                v-for="item in row.items" 
                :key="item.id"
                :item="item"
                :is-portrait="true"
                :show-title="false"
                class="card-portrait"
                @play="play(item)"
              />
            </div>
            <button @click="scrollRow('row-movies-' + row.name, 'right')" class="row-arrow row-arrow-right"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
          </div>
        </div>
      </template>
      <!-- Series category rows -->
      <template v-for="row in seriesRows" :key="'sr-' + row.name">
        <div>
          <div class="flex items-center justify-between mb-3 px-1">
            <h2 class="text-base md:text-lg font-bold text-gray-100">
              <span class="text-primary font-extrabold text-sm tracking-wider mr-2"></span>{{ row.name }}
            </h2>
            <button @click="router.push('/series')" class="text-xs text-gray-500 hover:text-primary transition-colors flex items-center gap-1 font-medium">
              Ver todas <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
          <div class="relative group/row">
            <button @click="scrollRow('row-series-' + row.name, 'left')" class="row-arrow row-arrow-left"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
            <div :id="'row-series-' + row.name" class="flex gap-3 overflow-x-auto no-scrollbar snap-x px-1" v-horizontal-scroll>
              <ContentCard
                v-for="item in row.items" 
                :key="item.id"
                :item="item"
                :is-portrait="true"
                :show-title="false"
                class="card-portrait"
                @play="play(item)"
              />
            </div>
            <button @click="scrollRow('row-series-' + row.name, 'right')" class="row-arrow row-arrow-right"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
          </div>
        </div>
      </template>



      </div> <!-- End Home View -->

      <!-- Clear data -->
      <div class="flex justify-end pt-4">
        <button @click="clearData" class="text-xs text-gray-700 hover:text-red-500 transition-colors flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6"/></svg>
          Limpar playlist
        </button>
      </div>
    </div>

    <!-- Error toast -->
    <div v-if="errorMsg" class="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-900 border border-red-700 text-red-200 px-6 py-3 rounded-full shadow-2xl flex items-center gap-4">
      <span class="text-sm">{{ errorMsg }}</span>
      <button @click="errorMsg = ''" class="hover:text-white ml-2">✕</button>
    </div>

    <!-- Player -->
    <VideoPlayer
      v-if="activeItem"
      :id="activeItem.id"
      :url="activeItem.url"
      :title="activeItem.name"
      :poster="activeItem.logo"
      @close="activeItem = null"
      @error="errorMsg = $event"
    />
  </div>
</template>

<style scoped>
/* ── Hero transitions ── */
.hero-fade-enter-active { transition: opacity 0.7s ease; }
.hero-fade-leave-active { transition: opacity 0.4s ease; }
.hero-fade-enter-from, .hero-fade-leave-to { opacity: 0; }

.hero-content-enter-active { transition: all 0.55s ease 0.15s; }
.hero-content-leave-active { transition: all 0.3s ease; }
.hero-content-enter-from  { opacity: 0; transform: translateY(18px); }
.hero-content-leave-to    { opacity: 0; transform: translateY(-8px); }


@keyframes heroZoom {
  from { transform: scale(1.06); }
  to   { transform: scale(1.00); }
}
.hero-zoom { animation: heroZoom 8s ease-out forwards; }

/* ── Scrollbars ── */
.no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

/* ── Arrow Navs ── */
.row-arrow {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 45px;
  background: rgba(0,0,0,0.5);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.3s ease, background 0.3s ease;
  backdrop-filter: blur(2px);
}
.row-arrow:hover {
  background: rgba(0,0,0,0.8);
}
.row-arrow-left { left: 0; border-top-right-radius: 0.5rem; border-bottom-right-radius: 0.5rem; }
.row-arrow-right { right: 0; border-top-left-radius: 0.5rem; border-bottom-left-radius: 0.5rem; }

/* Show arrows on hover of the row container */
.group\/row:hover .row-arrow { opacity: 1; }

/* ── Cards ── */
.card-portrait {
  flex-shrink: 0;
  scroll-snap-align: start;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  background: #111827;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  aspect-ratio: 2/3;
  width: calc((100% - (5 * 0.75rem)) / 6); /* 6 cards */
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-portrait img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain !important;
  padding: 0.375rem;
  border-radius: 0.375rem;
}


.card-portrait:hover {
  transform: scale(1.04);
  border-color: rgba(59,130,246,0.6);
  box-shadow: 0 8px 30px rgba(59,130,246,0.15);
  z-index: 10;
}

.card-landscape {
  flex-shrink: 0;
  scroll-snap-align: start;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  background: rgba(17,24,39,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  width: 25%;
  aspect-ratio: 16/9;
}
.card-landscape:hover {
  transform: scale(1.04);
  border-color: rgba(239,68,68,0.6);
  box-shadow: 0 8px 30px rgba(127,29,29,0.25);
  z-index: 10;
}

/* ── Grid Cards ── */
.card-landscape-grid {
  cursor: pointer;
  position: relative;
  overflow: hidden;
  background: rgba(17,24,39,0.8);
  border: 1px solid rgba(55,65,81,0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  aspect-ratio: 16/9;
  width: 100%;
}
.card-landscape-grid:hover {
  transform: scale(1.04);
  border-color: rgba(239,68,68,0.6);
  box-shadow: 0 8px 30px rgba(127,29,29,0.25);
  z-index: 10;
}

.card-portrait-grid {
  aspect-ratio: 2/3;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  border-radius: 6px;
  background: rgba(17,24,39,0.8);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-portrait-grid img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain !important;
  padding: 0.375rem;
  border-radius: 0.375rem;
}
.card-portrait-grid:hover {
  transform: scale(1.05);
  border-color: rgba(59,130,246,0.6);
  box-shadow: 0 8px 30px rgba(59,130,246,0.15);
  z-index: 10;
}

.card-portrait-grid:hover .card-play-overlay,
.card-landscape-grid:hover .card-play-overlay { opacity: 1; }

.card-portrait-grid:hover .play-btn,
.card-landscape-grid:hover .play-btn { transform: scale(1); }

/* Play overlay — hidden by default, visible on hover */
.card-play-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  backdrop-filter: blur(2px);
}
.card-portrait:hover .card-play-overlay,
.card-landscape:hover .card-play-overlay { opacity: 1; }

.play-btn {
  background: #2563eb;
  color: white;
  border-radius: 50%;
  padding: 0.625rem;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  transform: scale(0.75);
  transition: transform 0.2s ease;
}
.card-portrait:hover .play-btn,
.card-landscape:hover .play-btn { transform: scale(1); }
.play-btn-red { background: #dc2626; }

/* ── Page scroll ── */
.scrollbar-thin { scrollbar-width: thin; scrollbar-color: #1f2937 transparent; }
.scrollbar-thin::-webkit-scrollbar { width: 4px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 2px; }
</style>
