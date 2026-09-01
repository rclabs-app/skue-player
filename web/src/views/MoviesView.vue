<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePlaylistStore } from '../stores/playlist'
import { useFavoritesStore } from '../stores/favorites'
import { useHistoryStore } from '../stores/history'
import { cleanName } from '../utils/text'
import type { PlaylistItem } from '../types/m3u'
import ContentCard from '../components/ContentCard.vue'

import { TMDBService } from '../services/tmdb.service'
import { db } from '../lib/database'
import type { TMDBMetadata } from '../lib/database'
import { useSpatialNav } from '../composables/useSpatialNav'
import { useTvRemote } from '../composables/useTvRemote'

const store = usePlaylistStore()
const favoritesStore = useFavoritesStore()
const historyStore = useHistoryStore()
const router = useRouter()

const heroItems = ref<PlaylistItem[]>([])
const heroIndex = ref(0)
const currentHero = computed(() => heroItems.value[heroIndex.value] || null)
let heroInterval: number | null = null
const tmdbHeroMetadata = ref<TMDBMetadata | null>(null)
const heroMetaCache = ref<Record<string, TMDBMetadata>>({})

watch(currentHero, async (newVal) => {
  tmdbHeroMetadata.value = null
  if (newVal) {
    const cached = heroMetaCache.value[newVal.id]
    if (cached) {
      tmdbHeroMetadata.value = cached
    } else {
      const meta = await TMDBService.getMetadata(newVal.id, newVal.name, 'movie')
      heroMetaCache.value[newVal.id] = meta
      tmdbHeroMetadata.value = meta
    }
  }
}, { immediate: true })

// Preload TMDB wallpapers for all hero items so the banner doesn't flash
// with the poster/logo while auto-rotating.
async function preloadHeroMetadata() {
  const items = heroItems.value
  await Promise.all(
    items.map(async (item) => {
      if (heroMetaCache.value[item.id]) return
      const meta = await TMDBService.getMetadata(item.id, item.name, 'movie')
      heroMetaCache.value[item.id] = meta
      if (currentHero.value?.id === item.id) {
        tmdbHeroMetadata.value = meta
      }
    })
  )
}

function startHeroTimer() {
  if (heroInterval) clearInterval(heroInterval)
  heroInterval = window.setInterval(() => {
    if (heroItems.value.length > 0) {
      heroIndex.value = (heroIndex.value + 1) % heroItems.value.length
    }
  }, 6000)
}

function nextHero() {
  if (heroItems.value.length > 1)
    heroIndex.value = (heroIndex.value + 1) % heroItems.value.length
}

function prevHero() {
  if (heroItems.value.length > 1)
    heroIndex.value = (heroIndex.value - 1 + heroItems.value.length) % heroItems.value.length
}

function stopHeroTimer() {
  if (heroInterval) {
    clearInterval(heroInterval)
    heroInterval = null
  }
}

const activeGroup = ref<string>('ALL')
const errorMsg = ref('')
const searchQuery = ref('')
const sentinel = ref<HTMLElement | null>(null)
const scrollArea = ref<HTMLElement | null>(null)
const observer = ref<IntersectionObserver | null>(null)
const isPageLoading = ref(true)

// ── TV Navigation ────────────────────────────────────────────────────────
const appSidebarZone = computed(() => document.querySelector('[data-tv-zone="sidebar"]') as HTMLElement | null)
const catZone     = ref<HTMLElement | null>(null)
const gridZone    = ref<HTMLElement | null>(null)

const nav = useSpatialNav()
nav.registerZone('sidebar',    appSidebarZone, { defaultFocusSelector: '[data-route="movies"]' })
nav.registerZone('categories', catZone, { defaultFocusSelector: '.border-primary' })
nav.registerZone('grid',       gridZone)
nav.setZoneRule('sidebar',    'RIGHT', 'categories')
nav.setZoneRule('categories', 'LEFT',  'sidebar')
nav.setZoneRule('categories', 'RIGHT', 'grid')
nav.setZoneRule('grid',       'LEFT',  'categories')
nav.activate()

// Channel up/down = navigate categories
const { onRemoteKey } = useTvRemote()
const groupKeys = computed(() => [
  { key: 'ALL' },
  { key: 'FAVORITES' },
  { key: 'CONTINUE' },
  ...groups.value.map(g => ({ key: g.name }))
])

onRemoteKey('CHANNEL_UP',   () => { cycleGroup(-1) })
onRemoteKey('CHANNEL_DOWN', () => { cycleGroup(1) })
onRemoteKey('PAGE_UP',      () => { cycleGroup(-1) })
onRemoteKey('PAGE_DOWN',    () => { cycleGroup(1) })

function cycleGroup(delta: number) {
  const keys = groupKeys.value
  const idx = keys.findIndex(g => g.key === activeGroup.value)
  const next = keys[(idx + delta + keys.length) % keys.length]
  if (next) selectGroup(next.key)
}

const totalMovies = ref(0)
const totalFavorites = ref(0)

onMounted(async () => {
  if (!store.isLoaded) {
    router.push('/onboarding')
    return
  }
  isPageLoading.value = true
  await favoritesStore.loadFavorites()
  await historyStore.loadHistory()
  
  // Load initial data
  groups.value = await db.getCategoriesWithCount('movie')
  heroItems.value = await db.getPlaylistItems('movie', 5, 0)
  totalMovies.value = await db.getPlaylistItemCount('movie')
  
  const allFavorites = await db.getFavorites()
  const favMovies = await Promise.all(allFavorites.map(id => db.getPlaylistItemById(id)))
  totalFavorites.value = favMovies.filter(m => m && m.type === 'movie').length
  
  await fetchItems(true) // Initial fetch
  
  setupObserver()
  startHeroTimer()
  
  const minDelay = new Promise(r => setTimeout(r, 400))
  
  if (heroItems.value.length > 0) {
    await TMDBService.getMetadata(heroItems.value[0].id, heroItems.value[0].name, 'movie')
  }
  preloadHeroMetadata()
  
  await minDelay
  isPageLoading.value = false
  setTimeout(() => nav.focusZone('categories'), 100)
})

onUnmounted(() => {
  observer.value?.disconnect()
  stopHeroTimer()
})

const groups = ref<{name: string, count: number}[]>([])

// Progressive rendering — 60 at a time
const visibleItems = ref<PlaylistItem[]>([])
const hasMore = ref(true)
let page = 1
let isLoading = false

async function fetchItems(reset = false) {
  if (reset) {
    page = 1
    visibleItems.value = []
    hasMore.value = true
  }
  
  if (!hasMore.value || isLoading) return
  isLoading = true
  
  try {
    const limit = 60
    const offset = (page - 1) * limit
    let items: PlaylistItem[] = []
    
    if (searchQuery.value.trim()) {
      // NOTE: Our current searchItemsByType does not support limit/offset directly,
      // but it already limits to 50 items. For full pagination we'd need to update it.
      // For now, we fetch all matches from the DB and slice them locally.
      const allResults = await db.searchItemsByType(searchQuery.value.trim(), 'movie', 500)
      items = allResults.slice(offset, offset + limit)
    } else if (activeGroup.value === 'ALL') {
      items = await db.getPlaylistItems('movie', limit, offset)
    } else if (activeGroup.value === 'FAVORITES') {
      const allMovies = await db.getPlaylistItems('movie', 10000, 0)
      const favs = allMovies.filter(m => favoritesStore.isFavorite(m.id))
      items = favs.slice(offset, offset + limit)
    } else if (activeGroup.value === 'CONTINUE') {
      const history = historyStore.activelyWatching
        .filter(item => item.metadata.type === 'movie')
        .map(item => item.metadata)
      items = history.slice(offset, offset + limit)
    } else {
      items = await db.getItemsByCategoryAndType(activeGroup.value, 'movie', limit, offset)
    }
    
    if (items.length < limit) {
      hasMore.value = false
    }
    
    visibleItems.value.push(...items)
    page++
  } finally {
    isLoading = false
  }
}

function loadMore() {
  fetchItems()
}

// Re-attach observer when sentinel re-renders
watch(sentinel, () => {
  observer.value?.disconnect()
  setupObserver()
})

function setupObserver() {
  if (!sentinel.value) return
  observer.value = new IntersectionObserver(
    (entries) => { if (entries[0].isIntersecting) loadMore() },
    { rootMargin: '300px' }   // pre-load 300px before reaching the bottom
  )
  observer.value.observe(sentinel.value)
}

function selectGroup(name: string) {
  activeGroup.value = name
  searchQuery.value = ''
  fetchItems(true)
  // Reset scroll to top immediately
  if (scrollArea.value) scrollArea.value.scrollTop = 0
}

let searchTimeout: any = null
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    fetchItems(true)
  }, 300)
})

function playMovie(movie: PlaylistItem) {
  router.push('/details/' + encodeURIComponent(movie.id))
}

function extractYear(name: string): string | null {
  const match = name.match(/\((\d{4})\)/) || name.match(/\s(\d{4})$/)
  return match ? match[1] : null
}
</script>

<template>
  <div class="flex h-full bg-[#0f171e] relative">

    <!-- Loading State -->
    <div v-if="isPageLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-[#0f171e] z-50">
      <div class="w-12 h-12 border-4 border-gray-700 border-t-primary rounded-full animate-spin mb-4"></div>
      <p class="text-gray-400 font-medium">Carregando catálogo...</p>
    </div>

    <!-- ── Categories Sidebar ── -->
    <aside ref="catZone" class="w-56 lg:w-64 shrink-0 flex flex-col overflow-hidden">
      <div class="px-5 pt-6 pb-4">
        <div class="flex items-center gap-2 mb-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary shrink-0"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>
          <h1 class="text-white font-bold text-lg tracking-wide">Filmes</h1>
        </div>
        <p class="text-gray-500 text-xs">{{ totalMovies.toLocaleString('pt-BR') }} títulos</p>
      </div>

      <!-- Search -->
      <div class="px-4 py-3">
        <div class="flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500 shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input v-model="searchQuery" type="text" placeholder="Buscar filme..." class="bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none w-full" />
          <button v-if="searchQuery" @click="searchQuery = ''" class="text-gray-500 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>

      <!-- Category list -->
      <div class="flex-1 overflow-y-auto py-2">
        <button @click="selectGroup('ALL')" @keydown.enter.prevent="selectGroup('ALL')" :class="['tv-category-btn w-full flex items-center justify-between px-5 py-2.5 text-sm text-left transition-all border-l-2', activeGroup === 'ALL' ? 'bg-primary/10 border-primary text-white font-semibold' : 'border-transparent text-gray-400 hover:bg-gray-800/40 hover:text-gray-200']">
          <span>Todos</span>
          <span class="text-xs text-gray-600 tabular-nums">{{ totalMovies.toLocaleString('pt-BR') }}</span>
        </button>
        <button @click="selectGroup('FAVORITES')" @keydown.enter.prevent="selectGroup('FAVORITES')" :class="['tv-category-btn w-full flex items-center justify-between px-5 py-2.5 text-sm text-left transition-all border-l-2', activeGroup === 'FAVORITES' ? 'bg-primary/10 border-primary text-white font-semibold' : 'border-transparent text-gray-400 hover:bg-gray-800/40 hover:text-gray-200']">
          <span>Favoritos</span>
          <span class="text-xs text-gray-600 tabular-nums">{{ totalFavorites.toLocaleString('pt-BR') }}</span>
        </button>
        <button @click="selectGroup('CONTINUE')" @keydown.enter.prevent="selectGroup('CONTINUE')" :class="['tv-category-btn w-full flex items-center justify-between px-5 py-2.5 text-sm text-left transition-all border-l-2', activeGroup === 'CONTINUE' ? 'bg-primary/10 border-primary text-white font-semibold' : 'border-transparent text-gray-400 hover:bg-gray-800/40 hover:text-gray-200']">
          <span>Continuar Assistindo</span>
          <span class="text-xs text-gray-600 tabular-nums">{{ historyStore.activelyWatching.filter(item => item.metadata.type === 'movie').length.toLocaleString('pt-BR') }}</span>
        </button>
        <button v-for="g in groups" :key="g.name" @click="selectGroup(g.name)" @keydown.enter.prevent="selectGroup(g.name)" :class="['tv-category-btn w-full flex items-center justify-between px-5 py-2.5 text-sm text-left transition-all border-l-2', activeGroup === g.name ? 'bg-primary/10 border-primary text-white font-semibold' : 'border-transparent text-gray-400 hover:bg-gray-800/40 hover:text-gray-200']">
          <span class="truncate pr-2">{{ g.name }}</span>
          <span class="text-xs text-gray-600 tabular-nums shrink-0">{{ g.count.toLocaleString('pt-BR') }}</span>
        </button>
      </div>
    </aside>

    <!-- ── Content Area ── -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Top bar -->
      <div class="flex items-center justify-between px-6 py-4 shrink-0">
        <div>
          <h2 class="text-white font-bold text-lg">{{ activeGroup === 'ALL' ? 'Todos os Filmes' : activeGroup }}</h2>
        </div>
      </div>

      <!-- Error toast -->
      <div v-if="errorMsg" class="mx-6 mt-3 bg-red-900/80 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex justify-between items-center text-sm shrink-0">
        <span>{{ errorMsg }}</span>
        <button @click="errorMsg = ''" class="ml-4 hover:text-white">✕</button>
      </div>

      <!-- Scrollable grid -->
      <div ref="scrollArea" class="flex-1 overflow-y-auto relative">
        <div ref="gridZone" data-tv-zone="movies-grid">
        <!-- Hero Banner Carousel -->
        <div 
          v-if="currentHero && activeGroup === 'ALL' && !searchQuery" 
          class="relative w-full h-[60vh] min-h-[550px] mb-6 flex-shrink-0 group overflow-hidden"
          @mouseenter="stopHeroTimer"
          @mouseleave="startHeroTimer"
        >
          
          <transition name="fade" mode="out-in">
            <div :key="currentHero.id" class="absolute inset-0 bg-[#0f171e]">
              <!-- Image Container without heavy masks -->
              <div class="absolute inset-0 w-full h-full">
                <img :src="(tmdbHeroMetadata && tmdbHeroMetadata.backdrop_url) || currentHero.logo" :class="['w-full h-full', (tmdbHeroMetadata && tmdbHeroMetadata.backdrop_url) ? 'opacity-75 object-cover object-[75%_center] md:object-right-top' : 'opacity-60 object-cover object-top']" />
              </div>
              
              <!-- Overlays for extra text contrast -->
              <div class="absolute inset-0 bg-gradient-to-r from-[#0f171e] via-[#0f171e]/70 to-transparent w-full md:w-[70%] z-0 pointer-events-none"></div>
              <div class="absolute inset-0 bg-gradient-to-t from-[#0f171e] via-[#0f171e]/40 to-transparent z-0 pointer-events-none"></div>
            </div>
          </transition>

          <div class="relative h-full flex flex-col justify-end pl-16 md:pl-20 pr-8 md:pr-12 md:w-2/3 z-10">
            <div class="flex items-center gap-2 mb-2">
              <span class="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider shadow-lg shadow-primary/30">FILME</span>
              <span class="text-green-400 text-[10px] font-bold tracking-widest uppercase">98% RELEVANTE</span>
              <span class="w-1 h-1 rounded-full bg-gray-500 inline-block"></span>
              <span class="text-gray-400 text-xs font-medium">{{ currentHero.group }}</span>
            </div>
            
            <h2 class="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-2 drop-shadow-2xl">{{ cleanName(currentHero.name) }}</h2>
            
            <div class="flex items-center gap-3 mb-4 mt-2">
              <span class="bg-transparent border border-white/40 text-white/80 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider">HD</span>
              <span class="text-gray-300 text-[10px] font-bold tracking-widest uppercase flex items-center gap-2"><span class="w-1 h-1 rounded-full bg-green-500"></span> DUBLADO / LEGENDADO</span>
              <span v-if="extractYear(currentHero.name)" class="text-gray-400 text-[10px] font-bold tracking-widest uppercase"> {{ extractYear(currentHero.name) }}</span>
            </div>
            
            <p class="text-gray-300 text-sm md:text-base line-clamp-3 leading-relaxed max-w-2xl mb-8 drop-shadow-md">
              {{ (tmdbHeroMetadata && tmdbHeroMetadata.overview) || 'Assista agora a este título exclusivo. Uma experiência completa em alta definição disponível na sua grade de filmes.' }}
            </p>

            <div class="flex items-center gap-3">
              <button 
                @click="playMovie(currentHero)" 
                class="flex items-center gap-2 bg-white text-black px-8 py-3 rounded-full font-bold text-sm hover:bg-gray-200 hover:scale-105 active:scale-95 transition-all duration-200 shadow-xl"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="mr-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                Saiba mais
              </button>
            </div>
          </div>
          
          <!-- Dots -->
          <div v-if="heroItems.length > 1" class="absolute bottom-4 right-8 z-20 flex gap-2 items-center">
            <button
              v-for="(_, i) in heroItems"
              :key="i"
              @click="heroIndex = i"
              :class="['rounded-full transition-all duration-300', i === heroIndex ? 'bg-white w-6 h-2' : 'bg-white/30 hover:bg-white/50 w-2 h-2']"
            />
          </div>

          <!-- Arrows -->
          <button
            v-if="heroItems.length > 1"
            @click.stop="prevHero"
            class="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm border border-white/10 hover:border-white/30 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button
            v-if="heroItems.length > 1"
            @click.stop="nextHero"
            class="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm border border-white/10 hover:border-white/30 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>

        <div class="px-6 pb-6">
          <!-- Empty state -->
          <div v-if="visibleItems.length === 0" class="flex flex-col items-center justify-center h-48 text-gray-600 gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 12h18"/></svg>
          <p>Nenhum filme encontrado.</p>
        </div>

          <!-- Card grid — only visibleItems rendered -->
          <div v-else class="grid grid-cols-6 gap-4">
            <ContentCard
              v-for="movie in visibleItems"
              :key="movie.id"
              :item="movie"
              :is-portrait="true"
              :show-title="false"
              @play="playMovie"
            />
          </div>

          <!-- Sentinel (IntersectionObserver target) -->
          <div ref="sentinel" class="w-full py-6 flex items-center justify-center">
            <div v-if="hasMore" class="flex items-center gap-2 text-gray-600 text-xs">
              <div class="w-4 h-4 border-2 border-gray-600 border-t-primary rounded-full animate-spin"></div>
              Carregando mais filmes…
            </div>
            <div v-else-if="visibleItems.length > 0" class="text-gray-700 text-xs">
              Todos os filmes exibidos
            </div>
          </div>
        </div>
        </div><!-- /gridZone -->
      </div>
    </div>

  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.8s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
