<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePlaylistStore } from '../stores/playlist'
import { useHistoryStore } from '../stores/history'
import { useFavoritesStore } from '../stores/favorites'
import { useTvRemote } from '../composables/useTvRemote'
import { cleanName } from '../utils/text'
import type { PlaylistItem, SeriesEntry } from '../types/m3u'
import VideoPlayer from '../components/VideoPlayer.vue'
import { EPGService, type EPGProgram } from '../services/epg.service'
import { TMDBService } from '../services/tmdb.service'
import type { TMDBMetadata } from '../lib/database'
import ContentCard from '../components/ContentCard.vue'
import { db } from '../lib/database'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

const store = usePlaylistStore()
const historyStore = useHistoryStore()
const favoritesStore = useFavoritesStore()
const router = useRouter()
const { onRemoteKey } = useTvRemote()

const showExitPopup = ref(false)
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

const hoveredItem = ref<any>(null)

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

function setCategoryHovered(item: any) {
  hoveredItem.value = item
}

const currentHero = computed(() => {
  if (hoveredItem.value) {
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
  
  // Rule 1: Focus Home button on mount
  setTimeout(() => focusMenu(0), 100)
})

onUnmounted(() => stopHeroTimer())

// --- Spatial Navigation Focus Logic ---

function focusMenu(index: number) {
  hoveredItem.value = null
  const menus = ['btn-menu-0', 'btn-menu-1', 'btn-menu-2', 'btn-menu-3']
  const el = document.getElementById(menus[index])
  if (el) el.focus()
}

function focusVerMais() {
  hoveredItem.value = null
  const el = document.getElementById('btn-ver-mais')
  if (el) {
    el.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function focusGridFirstItem() {
  const firstCard = document.querySelector('.content-card') as HTMLElement
  if (firstCard) firstCard.focus()
}

function exitApp() {
  if (Capacitor.isNativePlatform()) {
    CapApp.exitApp()
  } else if ((window as any).Android) {
    (window as any).Android.exitApp()
  } else {
    window.close()
  }
}

function cancelExit() {
  showExitPopup.value = false
  setTimeout(() => focusMenu(0), 50)
}

function findClosestCardInRow(row: HTMLElement, x: number) {
  const cards = Array.from(row.querySelectorAll('.content-card')) as HTMLElement[]
  if (cards.length === 0) return null
  let closest = cards[0]
  let minDiff = Infinity
  for (const card of cards) {
    const rect = card.getBoundingClientRect()
    const cardX = rect.left + rect.width / 2
    const diff = Math.abs(cardX - x)
    if (diff < minDiff) {
      minDiff = diff
      closest = card
    }
  }
  return closest
}

onRemoteKey('DOWN', () => {
  if (showExitPopup.value) return true
  const active = document.activeElement as HTMLElement
  if (!active) return false

  if (active.id.startsWith('btn-menu-')) {
    focusVerMais()
    return true
  }
  if (active.id === 'btn-ver-mais') {
    focusGridFirstItem()
    return true
  }
  if (active.classList.contains('content-card')) {
    const currentRow = active.closest('.content-row')
    if (currentRow) {
      const allRows = Array.from(document.querySelectorAll('.content-row'))
      const rowIndex = allRows.indexOf(currentRow as HTMLElement)
      if (rowIndex >= 0 && rowIndex < allRows.length - 1) {
        const nextRow = allRows[rowIndex + 1] as HTMLElement
        const activeRect = active.getBoundingClientRect()
        const target = findClosestCardInRow(nextRow, activeRect.left + activeRect.width / 2)
        if (target) target.focus({ preventScroll: true })
      }
      return true
    }
  }
  return false
})

onRemoteKey('UP', () => {
  if (showExitPopup.value) return true
  const active = document.activeElement as HTMLElement
  if (!active) return false

  if (active.id === 'btn-ver-mais') {
    const categories = ['Home', 'Esportes', 'News', 'Infantil']
    let activeCategoryIndex = categories.indexOf(activeCategory.value)
    if (activeCategoryIndex < 0) activeCategoryIndex = 0
    focusMenu(activeCategoryIndex)
    return true
  }
  if (active.classList.contains('content-card')) {
    const currentRow = active.closest('.content-row')
    if (currentRow) {
      const allRows = Array.from(document.querySelectorAll('.content-row'))
      const rowIndex = allRows.indexOf(currentRow as HTMLElement)
      if (rowIndex > 0) {
        const prevRow = allRows[rowIndex - 1] as HTMLElement
        const activeRect = active.getBoundingClientRect()
        const target = findClosestCardInRow(prevRow, activeRect.left + activeRect.width / 2)
        if (target) target.focus({ preventScroll: true })
      } else {
        focusVerMais()
      }
      return true
    }
  }
  // Let native handle other UP navigation, but we could catch grid up here if needed
  return false
})

onRemoteKey('LEFT', () => {
  if (showExitPopup.value) {
    if (document.activeElement?.id === 'popup-nao') {
      document.getElementById('popup-sim')?.focus()
    }
    return true
  }
  const active = document.activeElement as HTMLElement
  if (!active) return false

  if (active.id === 'btn-ver-mais') {
    prevHero()
    return true
  }
  if (active.id.startsWith('btn-menu-')) {
    const idx = parseInt(active.id.split('-').pop() || '0')
    if (idx > 0) {
      focusMenu(idx - 1)
    } else {
      const sidebarHome = document.querySelector('.tv-nav-icon') as HTMLElement
      if (sidebarHome) sidebarHome.focus()
    }
    return true
  }
  if (active.classList.contains('content-card')) {
    const currentRow = active.closest('.content-row')
    if (currentRow) {
      const cards = Array.from(currentRow.querySelectorAll('.content-card')) as HTMLElement[]
      const idx = cards.indexOf(active)
      if (idx > 0) {
        const targetCard = cards[idx - 1]
        targetCard.focus({ preventScroll: true })
        const containerRect = currentRow.getBoundingClientRect()
        const targetRect = targetCard.getBoundingClientRect()
        if (targetRect.left < containerRect.left) {
          currentRow.scrollBy({ left: -(containerRect.width * 0.8), behavior: 'smooth' })
        }
        return true
      } else {
        const sidebarHome = document.querySelector('.tv-nav-icon') as HTMLElement
        if (sidebarHome) sidebarHome.focus()
        return true
      }
    }
  }
  return false
})

onRemoteKey('RIGHT', () => {
  if (showExitPopup.value) {
    if (document.activeElement?.id === 'popup-sim') {
      document.getElementById('popup-nao')?.focus()
    }
    return true
  }
  const active = document.activeElement as HTMLElement
  if (!active) return false
  
  if (active.classList.contains('tv-nav-icon')) {
    const scrollY = window.scrollY || document.documentElement.scrollTop
    if (scrollY < 100) {
      const topMenu = document.getElementById('btn-menu-0')
      if (topMenu) topMenu.focus()
    } else {
      const cards = Array.from(document.querySelectorAll('.content-card')) as HTMLElement[]
      for (const card of cards) {
        const rect = card.getBoundingClientRect()
        if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
          card.focus({ preventScroll: true })
          break
        }
      }
    }
    return true
  }

  if (active.id === 'btn-ver-mais') {
    nextHero()
    return true
  }
  if (active.id.startsWith('btn-menu-')) {
    const idx = parseInt(active.id.split('-').pop() || '0')
    if (idx < 3) focusMenu(idx + 1)
    return true
  }
  if (active.classList.contains('content-card')) {
    const currentRow = active.closest('.content-row')
    if (currentRow) {
      const cards = Array.from(currentRow.querySelectorAll('.content-card')) as HTMLElement[]
      const idx = cards.indexOf(active)
      if (idx < cards.length - 1) {
        const targetCard = cards[idx + 1]
        targetCard.focus({ preventScroll: true })
        const containerRect = currentRow.getBoundingClientRect()
        const targetRect = targetCard.getBoundingClientRect()
        if (targetRect.right > containerRect.right) {
          currentRow.scrollBy({ left: containerRect.width * 0.8, behavior: 'smooth' })
        }
        return true
      }
    }
  }
  return false
})

onRemoteKey('OK', () => {
  if (showExitPopup.value) {
    if (document.activeElement?.id === 'popup-sim') {
      exitApp()
    } else {
      cancelExit()
    }
    return true
  }
  const active = document.activeElement as HTMLElement
  if (active?.id === 'hero-banner') {
    if (currentHero.value) play(currentHero.value)
    return true
  }
  // Native OK behavior will click focused elements automatically
  return false
})

onRemoteKey('BACK', () => {
  if (activeItem.value) return false // Let VideoPlayer handle back

  if (showExitPopup.value) {
    cancelExit()
    return true
  }

  const active = document.activeElement as HTMLElement
  if (active && active.id === 'btn-menu-0') {
    showExitPopup.value = true
    setTimeout(() => document.getElementById('popup-nao')?.focus(), 50)
  } else {
    focusMenu(0)
  }
  return true
})
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
        <button id="btn-menu-0" tabindex="0" @click="setCategory('Home')" :class="['font-bold text-lg transition-colors tracking-wide drop-shadow-lg focus:outline-none focus:bg-white focus:!text-black px-4 py-1.5 rounded', activeCategory === 'Home' ? 'text-white' : 'text-gray-400 hover:text-white']">Home</button>
        <button id="btn-menu-1" tabindex="0" @click="setCategory('Esportes')" :class="['font-medium text-base transition-colors drop-shadow-lg focus:outline-none focus:bg-white focus:!text-black px-4 py-1.5 rounded', activeCategory === 'Esportes' ? 'text-white font-bold' : 'text-gray-300 hover:text-white']">Esportes</button>
        <button id="btn-menu-2" tabindex="0" @click="setCategory('News')" :class="['font-medium text-base transition-colors drop-shadow-lg focus:outline-none focus:bg-white focus:!text-black px-4 py-1.5 rounded', activeCategory === 'News' ? 'text-white font-bold' : 'text-gray-300 hover:text-white']">News</button>
        <button id="btn-menu-3" tabindex="0" @click="setCategory('Infantil')" :class="['font-medium text-base transition-colors drop-shadow-lg focus:outline-none focus:bg-white focus:!text-black px-4 py-1.5 rounded', activeCategory === 'Infantil' ? 'text-white font-bold' : 'text-gray-300 hover:text-white']">Infantil</button>
      </div>
    </header>

    <!-- ══════════════════════════════════════════════════
         HERO CAROUSEL
    ══════════════════════════════════════════════════ -->
    <section
      id="hero-banner"
      v-if="currentHero"
      class="relative w-full h-[60vh] min-h-[550px] select-none overflow-hidden transition-transform duration-300 focus-within:scale-[1.02] focus-within:z-40 focus-within:shadow-2xl"
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
          <div class="absolute -inset-1 bg-gradient-to-r from-[#0f171e] via-[#0f171e]/70 to-transparent w-full md:w-[70%] z-0 pointer-events-none"></div>
          <div class="absolute -inset-1 bg-gradient-to-t from-[#0f171e] via-[#0f171e]/40 to-transparent z-0 pointer-events-none"></div>
        </div>
      </Transition>

      <!-- Text and Button content -->
      <div class="absolute inset-0 z-20 h-full flex flex-col justify-end pl-16 md:pl-20 pr-10 md:pr-16 pb-16 max-w-4xl pointer-events-none">
        <Transition name="hero-content" mode="out-in">
          <div :key="currentHero.id" class="w-full">
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
          </div>
        </Transition>

        <div class="flex gap-4 pointer-events-auto">
          <button
            id="btn-ver-mais"
            tabindex="0"
            class="flex items-center gap-2.5 bg-white text-black px-8 py-3.5 rounded-full font-bold text-sm hover:bg-gray-100 hover:scale-105 focus:outline-none focus:bg-primary focus:!text-white focus:scale-105 transition-all duration-200 shadow-2xl"
            @click="play(currentHero)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            Ver mais
          </button>
        </div>
      </div>

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
                @play="play(item)" @focus="setCategoryHovered(item)"
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
                @play="play(item)" @focus="setCategoryHovered(item)"
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
          </div>
          <div class="relative">
            <div id="row-recent-movies" class="content-row flex gap-3 overflow-x-auto overflow-y-hidden no-scrollbar px-1 py-4 -my-4" tabindex="-1">
              <ContentCard
                v-for="item in recentMovies" 
                :key="item.id"
                :item="item"
                :is-portrait="true"
                :show-title="false"
                class="card-portrait"
                @play="play(item)" @focus="setCategoryHovered(item)"
              />
            </div>
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
          </div>
          <div class="relative group/row">
            <div id="row-recent-series" class="content-row flex gap-3 overflow-x-auto overflow-y-hidden no-scrollbar px-1 py-4 -my-4" tabindex="-1">
              <ContentCard
                v-for="item in recentSeries" 
                :key="item.id"
                :item="item"
                :is-portrait="true"
                :show-title="false"
                class="card-portrait"
                @play="play(item)" @focus="setCategoryHovered(item)"
              />
            </div>
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
            <div id="row-continue" class="content-row flex gap-3 overflow-x-auto overflow-y-hidden no-scrollbar px-1 py-4 -my-4" tabindex="-1">
              <ContentCard
                v-for="item in historyStore.activelyWatching" 
                :key="item.id"
                :item="item.metadata"
                :is-portrait="true"
                :show-title="false"
                :progress="historyStore.getProgressPercentage(item.id)"
                class="card-portrait"
                @play="play(item.metadata)"
                @focus="setCategoryHovered(item.metadata)"
              />
            </div>
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
            <div id="row-favorites" class="content-row flex gap-3 overflow-x-auto overflow-y-hidden no-scrollbar px-1 py-4 -my-4" tabindex="-1">
              <ContentCard
                v-for="item in favoriteItems" 
                :key="item.id"
                :item="item"
                :is-portrait="true"
                :show-title="false"
                class="card-portrait"
                @play="play(item)" @focus="setCategoryHovered(item)"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- Movie category rows -->
      <template v-for="(row, index) in movieRows" :key="'mr-' + row.name">
        <div>
          <div class="flex items-center justify-between mb-3 px-1">
            <h2 class="text-base md:text-lg font-bold text-gray-100">
              <span class="text-primary font-extrabold text-sm tracking-wider mr-2"></span>{{ row.name }}
            </h2>
          </div>
          <div class="relative group/row">
            <div :id="'row-movie-' + index" class="content-row flex gap-3 overflow-x-auto overflow-y-hidden no-scrollbar px-1 py-4 -my-4" tabindex="-1">
              <ContentCard
                v-for="item in row.items" 
                :key="item.id"
                :item="item"
                :is-portrait="true"
                :show-title="false"
                class="card-portrait"
                @play="play(item)" @focus="setCategoryHovered(item)"
              />
            </div>
          </div>
        </div>
      </template>
      <!-- Series category rows -->
      <template v-for="(row, index) in seriesRows" :key="'sr-' + row.name">
        <div>
          <div class="flex items-center justify-between mb-3 px-1">
            <h2 class="text-base md:text-lg font-bold text-gray-100">
              <span class="text-primary font-extrabold text-sm tracking-wider mr-2"></span>{{ row.name }}
            </h2>
          </div>
          <div class="relative group/row">
            <div :id="'row-series-' + index" class="content-row flex gap-3 overflow-x-auto overflow-y-hidden no-scrollbar px-1 py-4 -my-4" tabindex="-1">
              <ContentCard
                v-for="item in row.items" 
                :key="item.id"
                :item="item"
                :is-portrait="true"
                :show-title="false"
                class="card-portrait"
                @play="play(item)" @focus="setCategoryHovered(item)"
              />
            </div>
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

    <!-- Exit Popup -->
    <div v-if="showExitPopup" class="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-sm">
      <div class="bg-[#1a222c] border border-gray-700 p-8 rounded-2xl shadow-2xl text-center max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
        <h3 class="text-2xl font-bold text-white mb-8 drop-shadow-sm">Deseja sair da aplicação?</h3>
        <div class="flex gap-4 justify-center">
          <button id="popup-sim" tabindex="0" @click="exitApp" class="px-8 py-3.5 rounded-full bg-gray-700 text-white font-bold hover:bg-gray-600 focus:outline-none focus:ring-4 focus:ring-red-500 focus:bg-gray-600 focus:scale-105 transition-all">Sim</button>
          <button id="popup-nao" tabindex="0" @click="cancelExit" class="px-8 py-3.5 rounded-full bg-primary text-white font-bold hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-white focus:bg-blue-600 focus:scale-105 transition-all shadow-lg shadow-primary/30">Não</button>
        </div>
      </div>
    </div>
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
  width: calc((100% - (5 * 0.75rem)) / 6.5); /* 6.5 cards */
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
  width: calc((100% - (3 * 0.75rem)) / 4.5); /* 4.5 cards */
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
