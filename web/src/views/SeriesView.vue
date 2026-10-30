<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePlaylistStore } from '../stores/playlist'
import { useFavoritesStore } from '../stores/favorites'
import { useHistoryStore } from '../stores/history'
import { usePagedList } from '../composables/usePagedList'
import { cleanName } from '../utils/text'
import type { SeriesEntry } from '../types/m3u'
import ContentCard from '../components/ContentCard.vue'

import { TMDBService } from '../services/tmdb.service'
import type { TMDBMetadata } from '../lib/database'
import { useSpatialNav } from '../composables/useSpatialNav'
import { useTvRemote } from '../composables/useTvRemote'

const store = usePlaylistStore()
const favoritesStore = useFavoritesStore()
const historyStore = useHistoryStore()
const router = useRouter()

const heroItems = computed(() => {
  return store.uniqueSeries.slice(0, 5) as SeriesEntry[]
})
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
      const meta = await TMDBService.getMetadata(newVal.id, newVal.displayName, 'series')
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
      const meta = await TMDBService.getMetadata(item.id, item.displayName, 'series')
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
nav.registerZone('sidebar',    appSidebarZone, { defaultFocusSelector: '[href="/series"]' })
nav.registerZone('categories', catZone, { defaultFocusSelector: '[data-tv-active="true"]' })
nav.registerZone('grid',       gridZone)
nav.setZoneRule('sidebar',    'RIGHT', 'categories')
nav.setZoneRule('categories', 'LEFT',  'sidebar')
nav.setZoneRule('categories', 'RIGHT', 'grid')
nav.setZoneRule('grid',       'LEFT',  'categories')
nav.activate()

const { onRemoteKey } = useTvRemote()
const groupKeys = computed(() => [
  { key: 'ALL' },
  { key: 'FAVORITES' },
  { key: 'CONTINUE' },
  ...groups.value.map(g => ({ key: g.name }))
])
onRemoteKey('CHANNEL_UP',   () => cycleGroup(-1))
onRemoteKey('CHANNEL_DOWN', () => cycleGroup(1))
onRemoteKey('PAGE_UP',      () => cycleGroup(-1))
onRemoteKey('PAGE_DOWN',    () => cycleGroup(1))

function cycleGroup(delta: number) {
  const keys = groupKeys.value
  const idx = keys.findIndex(g => g.key === activeGroup.value)
  const next = keys[(idx + delta + keys.length) % keys.length]
  if (next) selectGroup(next.key)
}

onMounted(async () => {
  if (!store.isLoaded) {
    router.push('/onboarding')
    return
  }
  isPageLoading.value = true
  await favoritesStore.loadFavorites()
  await historyStore.loadHistory()
  setupObserver()
  startHeroTimer()
  
  const minDelay = new Promise(r => setTimeout(r, 400))
  
  // Wait for at least the first hero metadata to load to prevent flashing
  if (heroItems.value.length > 0) {
    await TMDBService.getMetadata(heroItems.value[0].id, heroItems.value[0].displayName, 'series')
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

const groups = computed(() => {
  const map: Record<string, number> = {}
  store.uniqueSeries.forEach((s: any) => {
    const g = s.group || 'Sem Categoria'
    map[g] = (map[g] || 0) + 1
  })
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
})

const filteredSeries = computed(() => {
  let list: SeriesEntry[] = []

  if (activeGroup.value === 'ALL') {
    list = store.uniqueSeries as SeriesEntry[]
  } else if (activeGroup.value === 'FAVORITES') {
    list = (store.uniqueSeries as SeriesEntry[]).filter(s => favoritesStore.isFavorite(s.id))
  } else if (activeGroup.value === 'CONTINUE') {
    const rawList = historyStore.activelyWatching
      .filter(item => item.metadata.type === 'series')
      .map(item => ({
        id: item.metadata.id,
        displayName: cleanName(item.metadata.name),
        group: item.metadata.group,
        logo: item.metadata.logo,
        serieKey: item.metadata.serieKey || cleanName(item.metadata.name).toLowerCase(),
        episodeCount: 0
      }) as SeriesEntry)
      
    const unique = new Map<string, SeriesEntry>()
    for (const s of rawList) {
      if (!unique.has(s.serieKey)) {
        unique.set(s.serieKey, s)
      }
    }
    list = Array.from(unique.values())
  } else {
    list = (store.uniqueSeries as SeriesEntry[]).filter(s => (s.group || 'Sem Categoria') === activeGroup.value)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(s => s.displayName.toLowerCase().includes(q))
  }
  return list
})

// Progressive rendering — 60 at a time
const { visibleItems, hasMore, loadMore } = usePagedList(filteredSeries, 60)

watch(sentinel, () => {
  observer.value?.disconnect()
  setupObserver()
})

function setupObserver() {
  if (!sentinel.value) return
  observer.value = new IntersectionObserver(
    (entries) => { if (entries[0].isIntersecting) loadMore() },
    { rootMargin: '300px' }
  )
  observer.value.observe(sentinel.value)
}

function selectGroup(name: string) {
  activeGroup.value = name
  searchQuery.value = ''
  if (scrollArea.value) scrollArea.value.scrollTop = 0
}

function playSeries(entry: SeriesEntry) {
  router.push('/details/' + encodeURIComponent(entry.id))
}

function extractYear(name?: string): string | null {
  if (!name) return null
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
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary shrink-0"><path d="M4 10h16"/><path d="M4 14h16"/><rect width="16" height="16" x="4" y="4" rx="2"/></svg>
          <h1 class="text-white font-bold text-lg tracking-wide">Séries</h1>
        </div>
        <p class="text-gray-500 text-xs">{{ store.uniqueSeries.length.toLocaleString('pt-BR') }} séries</p>
      </div>

      <div class="px-4 py-3">
        <div class="flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500 shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input v-model="searchQuery" type="text" placeholder="Buscar série..." class="bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none w-full" />
          <button v-if="searchQuery" @click="searchQuery = ''" class="text-gray-500 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto py-2">
        <button @click="selectGroup('ALL')" @keydown.enter.prevent="selectGroup('ALL')" :data-tv-active="activeGroup === 'ALL'" :class="['tv-category-btn w-full flex items-center justify-between px-5 py-2.5 text-sm text-left transition-all border-l-2', activeGroup === 'ALL' ? 'bg-primary/10 border-primary text-white font-semibold' : 'border-transparent text-gray-400 hover:bg-gray-800/40 hover:text-gray-200']">
          <span>Todos</span>
          <span class="text-xs text-gray-600 tabular-nums">{{ store.uniqueSeries.length.toLocaleString('pt-BR') }}</span>
        </button>
        <button @click="selectGroup('FAVORITES')" @keydown.enter.prevent="selectGroup('FAVORITES')" :data-tv-active="activeGroup === 'FAVORITES'" :class="['tv-category-btn w-full flex items-center justify-between px-5 py-2.5 text-sm text-left transition-all border-l-2', activeGroup === 'FAVORITES' ? 'bg-primary/10 border-primary text-white font-semibold' : 'border-transparent text-gray-400 hover:bg-gray-800/40 hover:text-gray-200']">
          <span>Favoritos</span>
          <span class="text-xs text-gray-600 tabular-nums">{{ store.uniqueSeries.filter((s: any) => favoritesStore.isFavorite(s.id)).length.toLocaleString('pt-BR') }}</span>
        </button>
        <button @click="selectGroup('CONTINUE')" @keydown.enter.prevent="selectGroup('CONTINUE')" :data-tv-active="activeGroup === 'CONTINUE'" :class="['tv-category-btn w-full flex items-center justify-between px-5 py-2.5 text-sm text-left transition-all border-l-2', activeGroup === 'CONTINUE' ? 'bg-primary/10 border-primary text-white font-semibold' : 'border-transparent text-gray-400 hover:bg-gray-800/40 hover:text-gray-200']">
          <span>Continuar Assistindo</span>
          <span class="text-xs text-gray-600 tabular-nums">{{ historyStore.activelyWatching.filter(item => item.metadata.type === 'series').length.toLocaleString('pt-BR') }}</span>
        </button>
        <button v-for="g in groups" :key="g.name" @click="selectGroup(g.name)" @keydown.enter.prevent="selectGroup(g.name)" :data-tv-active="activeGroup === g.name" :class="['tv-category-btn w-full flex items-center justify-between px-5 py-2.5 text-sm text-left transition-all border-l-2', activeGroup === g.name ? 'bg-primary/10 border-primary text-white font-semibold' : 'border-transparent text-gray-400 hover:bg-gray-800/40 hover:text-gray-200']">
          <span class="truncate pr-2">{{ g.name }}</span>
          <span class="text-xs text-gray-600 tabular-nums shrink-0">{{ g.count.toLocaleString('pt-BR') }}</span>
        </button>
      </div>
    </aside>

    <!-- ── Content Area ── -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <div class="flex items-center justify-between px-6 py-4 shrink-0">
        <div>
          <h2 class="text-white font-bold text-lg">{{ activeGroup === 'ALL' ? 'Todas as Séries' : activeGroup }}</h2>
          <p class="text-gray-500 text-xs mt-0.5">
            Exibindo {{ visibleItems.length.toLocaleString('pt-BR') }} de {{ filteredSeries.length.toLocaleString('pt-BR') }} séries
          </p>
        </div>
      </div>

      <div v-if="errorMsg" class="mx-6 mt-3 bg-red-900/80 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex justify-between items-center text-sm shrink-0">
        <span>{{ errorMsg }}</span>
        <button @click="errorMsg = ''" class="ml-4 hover:text-white">✕</button>
      </div>

      <div ref="scrollArea" class="flex-1 overflow-y-auto">
        <div ref="gridZone">
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
              <span class="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider shadow-lg shadow-primary/30">SÉRIE</span>
              <span class="text-green-400 text-[10px] font-bold tracking-widest uppercase">98% RELEVANTE</span>
              <span class="w-1 h-1 rounded-full bg-gray-500 inline-block"></span>
              <span class="text-gray-400 text-xs font-medium">{{ currentHero.group }}</span>
            </div>
            
            <h2 class="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-2 drop-shadow-2xl">{{ (currentHero as SeriesEntry).displayName }}</h2>
            
            <div class="flex items-center gap-3 mb-4 mt-2">
              <span class="bg-transparent border border-white/40 text-white/80 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider">HD</span>
              <span class="text-gray-300 text-[10px] font-bold tracking-widest uppercase flex items-center gap-2"><span class="w-1 h-1 rounded-full bg-green-500"></span> DUBLADO / LEGENDADO</span>
              <span v-if="extractYear(currentHero.displayName)" class="text-gray-400 text-[10px] font-bold tracking-widest uppercase"> {{ extractYear(currentHero.displayName) }}</span>
            </div>

            <p class="text-gray-300 text-sm md:text-base line-clamp-3 leading-relaxed max-w-2xl mb-8 drop-shadow-md">
              {{ (tmdbHeroMetadata && tmdbHeroMetadata.overview) || 'Assista agora a este título exclusivo. Uma experiência completa em alta definição disponível na sua grade de séries.' }}
            </p>

            <div class="flex items-center gap-3">
              <button 
                @click="playSeries(currentHero as SeriesEntry)" 
                @keydown.enter.prevent="playSeries(currentHero as SeriesEntry)"
                class="flex items-center gap-2 bg-white text-black px-8 py-3 rounded-full font-bold text-sm hover:bg-gray-200 hover:scale-105 active:scale-95 focus:scale-105 focus:bg-white focus:ring-4 focus:ring-primary/60 outline-none transition-all duration-200 shadow-xl"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="mr-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                Saiba mais
              </button>
            </div>
          </div>
          
          <!-- Dots -->
          <div v-if="heroItems.length > 1" class="absolute bottom-4 right-8 z-20 flex gap-2 items-center" data-tv-ignore>
            <button
              v-for="(_, i) in heroItems"
              :key="i"
              tabindex="-1"
              @click="heroIndex = i"
              :class="['rounded-full transition-all duration-300', i === heroIndex ? 'bg-white w-6 h-2' : 'bg-white/30 hover:bg-white/50 w-2 h-2']"
            />
          </div>

          <!-- Arrows -->
          <button
            v-if="heroItems.length > 1"
            data-tv-ignore
            tabindex="-1"
            @click.stop="prevHero"
            class="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm border border-white/10 hover:border-white/30 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button
            v-if="heroItems.length > 1"
            data-tv-ignore
            tabindex="-1"
            @click.stop="nextHero"
            class="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm border border-white/10 hover:border-white/30 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>

        <div class="px-6 pb-6">
          <div v-if="filteredSeries.length === 0" class="flex flex-col items-center justify-center h-48 text-gray-600 gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h16"/><path d="M4 14h16"/><rect width="16" height="16" x="4" y="4" rx="2"/></svg>
          <p>Nenhuma série encontrada.</p>
        </div>

          <div v-else class="grid grid-cols-6 gap-4">
            <ContentCard
              v-for="series in visibleItems"
              :key="series.id"
              :item="series"
              :is-portrait="true"
              :show-title="true"
              @play="playSeries(series as SeriesEntry)"
            />
          </div>

          <!-- Sentinel -->
          <div ref="sentinel" class="w-full py-6 flex items-center justify-center">
            <div v-if="hasMore" class="flex items-center gap-2 text-gray-600 text-xs">
              <div class="w-4 h-4 border-2 border-gray-600 border-t-primary rounded-full animate-spin"></div>
              Carregando mais séries…
            </div>
            <div v-else-if="filteredSeries.length > 0" class="text-gray-700 text-xs">
              Todas as {{ filteredSeries.length.toLocaleString('pt-BR') }} séries exibidas
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
