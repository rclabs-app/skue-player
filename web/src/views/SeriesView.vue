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
const hoveredItem = ref<SeriesEntry | null>(null)
const currentHero = computed(() => hoveredItem.value || heroItems.value[heroIndex.value] || null)
let heroInterval: number | null = null
const tmdbHeroMetadata = ref<TMDBMetadata | null>(null)
const heroMetaCache = ref<Record<string, TMDBMetadata>>({})

let hoverMetaTimeout: any = null

watch(currentHero, async (newVal) => {
  if (!newVal) {
    tmdbHeroMetadata.value = null
    return
  }

  const cached = heroMetaCache.value[newVal.id]
  if (cached) {
    tmdbHeroMetadata.value = cached
    return
  }

  // Se for por hover rápido, coloca um debounce leve
  clearTimeout(hoverMetaTimeout)
  hoverMetaTimeout = setTimeout(async () => {
    try {
      const meta = await TMDBService.getMetadata(newVal.id, (newVal as SeriesEntry).displayName, 'series')
      heroMetaCache.value[newVal.id] = meta
      if (currentHero.value?.id === newVal.id) {
        tmdbHeroMetadata.value = meta
      }
    } catch {
      // ignore
    }
  }, 150)
}, { immediate: true })

function onHoverSeries(series: any) {
  hoveredItem.value = series as SeriesEntry
  stopHeroTimer()
}

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
  if (hoveredItem.value) return
  if (heroInterval) clearInterval(heroInterval)
  heroInterval = window.setInterval(() => {
    if (heroItems.value.length > 0 && !hoveredItem.value) {
      heroIndex.value = (heroIndex.value + 1) % heroItems.value.length
    }
  }, 6000)
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
      <!-- Error toast -->
      <div v-if="errorMsg" class="mx-6 mt-3 bg-red-900/80 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex justify-between items-center text-sm shrink-0">
        <span>{{ errorMsg }}</span>
        <button @click="errorMsg = ''" class="ml-4 hover:text-white">✕</button>
      </div>

      <!-- Fixed Compact Hero Banner (atualiza ao passar o mouse ou dar foco nas séries) -->
      <div 
        v-if="currentHero" 
        class="mx-6 mt-5 h-60 min-h-[240px] max-h-[240px] bg-gray-900/90 border border-gray-800 rounded-2xl flex items-center gap-7 shrink-0 shadow-2xl relative overflow-hidden group"
        @mouseenter="stopHeroTimer"
        @mouseleave="startHeroTimer"
      >
        <!-- Background Wallpaper with Blur & Fade -->
        <div class="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <transition name="fade" mode="out-in">
            <div :key="currentHero.id" class="absolute inset-0 bg-[#0f171e]">
              <img 
                :src="(tmdbHeroMetadata && tmdbHeroMetadata.backdrop_url) || currentHero.logo" 
                :class="['w-full h-full', (tmdbHeroMetadata && tmdbHeroMetadata.backdrop_url) ? 'opacity-40 object-cover object-[75%_center]' : 'opacity-25 object-cover object-center blur-sm']" 
              />
              <div class="absolute inset-0 bg-gradient-to-r from-[#0f171e] via-[#0f171e]/85 to-transparent w-full md:w-[75%]"></div>
              <div class="absolute inset-0 bg-gradient-to-t from-[#0f171e] via-transparent to-transparent"></div>
            </div>
          </transition>
        </div>

        <!-- Poster Thumbnail -->
        <div class="w-36 h-52 ml-6 bg-black/60 rounded-xl flex-shrink-0 border border-gray-700/60 flex items-center justify-center relative z-10 overflow-hidden shadow-xl">
          <img 
            v-if="currentHero.logo" 
            :src="currentHero.logo" 
            class="w-full h-full object-cover" 
          />
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-gray-600"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 12h18"/></svg>
        </div>

        <!-- Series Details -->
        <div class="flex-1 flex flex-col justify-center relative z-10 pr-6 py-2 overflow-hidden">
          <div class="flex items-center gap-2 mb-1.5 flex-wrap">
            <span class="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider shadow-sm">SÉRIE</span>
            <span class="text-green-400 text-[10px] font-bold tracking-widest uppercase">98% RELEVANTE</span>
            <span class="w-1 h-1 rounded-full bg-gray-500 inline-block"></span>
            <span class="text-gray-400 text-xs font-medium truncate max-w-xs">{{ currentHero.group }}</span>
            <span v-if="extractYear((currentHero as SeriesEntry).displayName)" class="text-gray-400 text-xs font-semibold">· {{ extractYear((currentHero as SeriesEntry).displayName) }}</span>
            <span class="bg-transparent border border-white/30 text-white/80 text-[9px] font-bold px-1.5 py-0.2 rounded tracking-wider ml-1">HD</span>
          </div>

          <h3 class="text-white font-bold text-2xl lg:text-3xl mb-1.5 drop-shadow-md tracking-tight truncate">{{ (currentHero as SeriesEntry).displayName }}</h3>

          <p class="text-gray-300 text-xs md:text-sm line-clamp-2 leading-relaxed max-w-4xl drop-shadow">
            {{ (tmdbHeroMetadata && tmdbHeroMetadata.overview) || 'Selecione ou clique na série para navegar pelas temporadas, episódios e assistir em alta definição.' }}
          </p>
        </div>
      </div>

      <!-- Scrollable grid -->
      <div ref="scrollArea" class="flex-1 overflow-y-auto p-6">
        <div ref="gridZone">
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
              @mouseenter="onHoverSeries(series)"
              @focus="onHoverSeries(series)"
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
        </div><!-- /gridZone -->
      </div>
    </div>

  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.8s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
