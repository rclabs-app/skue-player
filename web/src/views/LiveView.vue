<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlaylistStore } from '../stores/playlist'
import { useFavoritesStore } from '../stores/favorites'
import { useHistoryStore } from '../stores/history'

import type { PlaylistItem } from '../types/m3u'
import VideoPlayer from '../components/VideoPlayer.vue'
import ContentCard from '../components/ContentCard.vue'
import { EPGService, type EPGProgram } from '../services/epg.service'

import { db } from '../lib/database'
import { useSpatialNav } from '../composables/useSpatialNav'
import { useTvRemote } from '../composables/useTvRemote'

const store = usePlaylistStore()
const favoritesStore = useFavoritesStore()
const historyStore = useHistoryStore()
const router = useRouter()

const activeGroup = ref<string>('ALL')
const activeChannel = ref<PlaylistItem | null>(null)
const focusedChannel = ref<PlaylistItem | null>(null)
const currentProgram = ref<EPGProgram | null>(null)
const errorMsg = ref('')
const searchQuery = ref('')
const sentinel = ref<HTMLElement | null>(null)
const scrollArea = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
const isPageLoading = ref(true)
const isEpgLoading = ref(false)

onMounted(async () => {
  if (!store.isLoaded) {
    router.push('/onboarding')
    return
  }
  
  isPageLoading.value = true
  
  try {
    await favoritesStore.loadFavorites()
    await historyStore.loadHistory()
    
    // Load initial data
    groups.value = await db.getCategoriesWithCount('live')
    
    await fetchItems(true) // Initial fetch
    
    setupObserver()
    await new Promise(r => setTimeout(r, 400))
  } catch (e) {
    errorMsg.value = 'Erro ao carregar canais.'
    console.error(e)
  } finally {
    isPageLoading.value = false
    setTimeout(() => nav.focusZone('categories'), 100)
  }
})

onUnmounted(() => observer?.disconnect())

const groups = ref<{name: string, count: number}[]>([])

// ── TV Navigation ────────────────────────────────────────────────────────
const appSidebarZone = computed(() => document.querySelector('[data-tv-zone="sidebar"]') as HTMLElement | null)
const catZone     = ref<HTMLElement | null>(null)
const gridZone    = ref<HTMLElement | null>(null)

const nav = useSpatialNav()
nav.registerZone('sidebar',    appSidebarZone, { defaultFocusSelector: '[href="/live"]' })
nav.registerZone('categories', catZone, { defaultFocusSelector: '[data-tv-active="true"]' })
nav.registerZone('grid',       gridZone)
nav.setZoneRule('sidebar',    'RIGHT', 'categories')
nav.setZoneRule('categories', 'LEFT',  'sidebar')
nav.setZoneRule('categories', 'RIGHT', 'grid')
nav.setZoneRule('grid',       'LEFT',  'categories')
nav.activate()

const { onRemoteKey } = useTvRemote()
onRemoteKey('CHANNEL_UP',   () => cycleGroup(-1))
onRemoteKey('CHANNEL_DOWN', () => cycleGroup(1))
onRemoteKey('PAGE_UP',      () => cycleGroup(-1))
onRemoteKey('PAGE_DOWN',    () => cycleGroup(1))

function cycleGroup(delta: number) {
  const allKeys = [
    { key: 'ALL' }, { key: 'FAVORITES' }, { key: 'CONTINUE' },
    ...groups.value.map(g => ({ key: g.name }))
  ]
  const idx = allKeys.findIndex(g => g.key === activeGroup.value)
  const next = allKeys[(idx + delta + allKeys.length) % allKeys.length]
  if (next) selectGroup(next.key)
}

// Progressive rendering — 80 channels at a time (smaller cards = can show more)
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
    const limit = 80
    const offset = (page - 1) * limit
    let items: PlaylistItem[] = []
    
    if (searchQuery.value.trim()) {
      const allResults = await db.searchItemsByType(searchQuery.value.trim(), 'live', 500)
      items = allResults.slice(offset, offset + limit)
    } else if (activeGroup.value === 'ALL') {
      items = await db.getPlaylistItems('live', limit, offset)
    } else if (activeGroup.value === 'FAVORITES') {
      const allLive = await db.getPlaylistItems('live', 10000, 0)
      const favs = allLive.filter(m => favoritesStore.isFavorite(m.id))
      items = favs.slice(offset, offset + limit)
    } else if (activeGroup.value === 'CONTINUE') {
      const history = historyStore.activelyWatching
        .filter(item => item.metadata.type === 'live')
        .map(item => item.metadata)
      items = history.slice(offset, offset + limit)
    } else {
      items = await db.getItemsByCategoryAndType(activeGroup.value, 'live', limit, offset)
    }
    
    if (items.length < limit) {
      hasMore.value = false
    }
    
    visibleItems.value.push(...items)
    
    if (!focusedChannel.value && visibleItems.value.length > 0) {
      focusedChannel.value = visibleItems.value[0]
    }
    
    page++
  } finally {
    isLoading = false
  }
}

function loadMore() {
  fetchItems()
}

watch(sentinel, () => {
  observer?.disconnect()
  setupObserver()
})

function setupObserver() {
  if (!sentinel.value) return
  observer = new IntersectionObserver(
    (entries) => { if (entries[0].isIntersecting) loadMore() },
    { rootMargin: '300px' }
  )
  observer.observe(sentinel.value)
}

function selectGroup(name: string) {
  activeGroup.value = name
  searchQuery.value = ''
  fetchItems(true)
  if (scrollArea.value) scrollArea.value.scrollTop = 0
}

let searchTimeout: any = null
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    fetchItems(true)
  }, 300)
})

function playChannel(channel: PlaylistItem) {
  errorMsg.value = ''
  activeChannel.value = channel
}

watch(focusedChannel, async (newVal) => {
  if (newVal) {
    isEpgLoading.value = true
    currentProgram.value = await EPGService.getCurrentProgram(newVal.id, newVal.name, newVal.group, newVal.epgId)
    isEpgLoading.value = false
  } else {
    currentProgram.value = null
    isEpgLoading.value = false
  }
})

watch(visibleItems, (items) => {
  if (items.length > 0 && !focusedChannel.value) {
    focusedChannel.value = items[0]
  }
}, { immediate: true })

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
</script>

<template>
  <div class="flex h-full bg-[#0f171e] relative">
    
    <!-- Loading State -->
    <div v-if="isPageLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-[#0f171e] z-50">
      <div class="w-12 h-12 border-4 border-gray-700 border-t-primary rounded-full animate-spin mb-4"></div>
      <p class="text-gray-400 font-medium">Carregando catálogo...</p>
    </div>

    <!-- ── Categories Sidebar ── -->
    <aside ref="catZone" class="w-56 lg:w-64 shrink-0 flex flex-col bg-black/30 border-r border-gray-800/60 overflow-hidden">
      <div class="px-5 pt-6 pb-4 border-b border-gray-800/60">
        <div class="flex items-center gap-2 mb-1">
          <span class="relative flex h-2.5 w-2.5 shrink-0">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
          </span>
          <h1 class="text-white font-bold text-lg tracking-wide">TV Ao Vivo</h1>
        </div>
        <p class="text-gray-500 text-xs">Canais Disponíveis</p>
      </div>

      <div class="px-4 py-3 border-b border-gray-800/40">
        <div class="flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500 shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input v-model="searchQuery" type="text" placeholder="Buscar canal..." class="bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none w-full" />
          <button v-if="searchQuery" @click="searchQuery = ''" class="text-gray-500 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto py-2">
        <button @click="selectGroup('ALL')" @keydown.enter.prevent="selectGroup('ALL')" :data-tv-active="activeGroup === 'ALL'" :class="['tv-category-btn w-full flex items-center justify-between px-5 py-2.5 text-sm text-left transition-all border-l-2', activeGroup === 'ALL' ? 'bg-primary/10 border-primary text-white font-semibold' : 'border-transparent text-gray-400 hover:bg-gray-800/40 hover:text-gray-200']">
          <span>Todos</span>
          <span class="text-xs text-gray-600 tabular-nums"></span>
        </button>
        <button @click="selectGroup('FAVORITES')" @keydown.enter.prevent="selectGroup('FAVORITES')" :data-tv-active="activeGroup === 'FAVORITES'" :class="['tv-category-btn w-full flex items-center justify-between px-5 py-2.5 text-sm text-left transition-all border-l-2', activeGroup === 'FAVORITES' ? 'bg-primary/10 border-primary text-white font-semibold' : 'border-transparent text-gray-400 hover:bg-gray-800/40 hover:text-gray-200']">
          <span>Favoritos</span>
          <span class="text-xs text-gray-600 tabular-nums"></span>
        </button>
        <button @click="selectGroup('CONTINUE')" @keydown.enter.prevent="selectGroup('CONTINUE')" :class="['tv-category-btn w-full flex items-center justify-between px-5 py-2.5 text-sm text-left transition-all border-l-2', activeGroup === 'CONTINUE' ? 'bg-primary/10 border-primary text-white font-semibold' : 'border-transparent text-gray-400 hover:bg-gray-800/40 hover:text-gray-200']">
          <span>Continuar Assistindo</span>
          <span class="text-xs text-gray-600 tabular-nums"></span>
        </button>
        <button v-for="g in groups" :key="g.name" @click="selectGroup(g.name)" @keydown.enter.prevent="selectGroup(g.name)" :data-tv-active="activeGroup === g.name" :class="['tv-category-btn w-full flex items-center justify-between px-5 py-2.5 text-sm text-left transition-all border-l-2', activeGroup === g.name ? 'bg-primary/10 border-primary text-white font-semibold' : 'border-transparent text-gray-400 hover:bg-gray-800/40 hover:text-gray-200']">
          <span class="truncate pr-2">{{ g.name }}</span>
          <span class="text-xs text-gray-600 tabular-nums shrink-0">{{ g.count.toLocaleString('pt-BR') }}</span>
        </button>
      </div>
    </aside>

    <!-- ── Content Area ── -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800/40 shrink-0">
        <div>
          <h2 class="text-white font-bold text-lg">{{ activeGroup === 'ALL' ? 'Todos os Canais' : activeGroup }}</h2>
        </div>
      </div>

      <div v-if="errorMsg" class="mx-6 mt-3 bg-red-900/80 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex justify-between items-center text-sm shrink-0">
        <span>{{ errorMsg }}</span>
        <button @click="errorMsg = ''" class="ml-4 hover:text-white">✕</button>
      </div>

      <!-- EPG BANNER (Now Playing) -->
      <div v-if="focusedChannel" class="mx-6 mt-4 p-5 bg-gray-900/80 border border-gray-800 rounded-xl flex gap-6 shrink-0 shadow-2xl relative overflow-hidden">
        <!-- Background Blur of Channel Logo -->
        <div class="absolute inset-0 opacity-10 blur-2xl z-0 pointer-events-none">
          <img v-if="focusedChannel.logo" :src="focusedChannel.logo" class="w-full h-full object-cover" />
        </div>
        
        <div class="w-32 h-32 bg-black/50 rounded-lg flex-shrink-0 border border-gray-700/50 flex items-center justify-center relative z-10 overflow-hidden shadow-lg">
          <img v-if="focusedChannel.logo" :src="focusedChannel.logo" class="w-full h-full object-contain p-2" />
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-gray-600"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
        </div>
        
        <div class="flex-1 flex flex-col justify-center relative z-10">
          <h3 class="text-white font-bold text-2xl mb-1 drop-shadow-md">{{ focusedChannel.name }}</h3>
          
          <template v-if="currentProgram">
            <div class="text-primary font-semibold text-lg drop-shadow mb-1">{{ currentProgram.title }}</div>
            <div class="flex items-center gap-3 text-sm text-gray-400 mb-2 font-medium">
              <span class="bg-black/40 px-2 py-0.5 rounded text-gray-300 border border-gray-700/50">{{ formatTime(currentProgram.startTime) }} - {{ formatTime(currentProgram.endTime) }}</span>
              <span class="text-xs uppercase tracking-wider text-green-400 font-bold bg-green-400/10 px-2 py-0.5 rounded">Agora</span>
            </div>
            <p class="text-gray-400 text-sm line-clamp-2 leading-relaxed max-w-4xl">{{ currentProgram.description }}</p>
            
            <div class="mt-4 flex items-center gap-3 w-full max-w-2xl">
              <span class="text-xs text-gray-500 font-medium w-10">{{ formatTime(currentProgram.startTime) }}</span>
              <div class="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div class="bg-primary h-full rounded-full transition-all duration-1000" :style="{ width: getProgress(currentProgram) + '%' }"></div>
              </div>
              <span class="text-xs text-gray-500 font-medium w-10">{{ formatTime(currentProgram.endTime) }}</span>
            </div>
          </template>
          <template v-else-if="isEpgLoading">
            <div class="flex items-center gap-2 text-gray-500 text-sm h-full">
              <div class="w-4 h-4 border-2 border-gray-600 border-t-primary rounded-full animate-spin"></div>
              Carregando guia...
            </div>
          </template>
          <template v-else>
            <div class="flex items-center gap-2 text-gray-500 text-sm h-full font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Programação indisponível no momento.
            </div>
          </template>
        </div>

        <div class="flex flex-col justify-center relative z-10 ml-auto">
          <button @click="playChannel(focusedChannel)" class="bg-primary hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg flex items-center gap-2 transition-transform hover:scale-105 active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Assistir
          </button>
        </div>
      </div>

      <div ref="scrollArea" class="flex-1 overflow-y-auto p-6">
        <div ref="gridZone">
        <div v-if="visibleItems.length === 0" class="flex flex-col items-center justify-center h-full text-gray-600 gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
          <p>Nenhum canal encontrado.</p>
        </div>

        <div v-else class="grid grid-cols-6 gap-4">
          <ContentCard
            v-for="channel in visibleItems"
            :key="channel.id"
            :item="channel"
            :is-portrait="false"
            :show-title="true"
            @play="playChannel"
            @mouseenter="focusedChannel = channel"
            @focus="focusedChannel = channel"
          />
        </div>

        <!-- Sentinel -->
        <div ref="sentinel" class="w-full py-6 flex items-center justify-center">
          <div v-if="hasMore" class="flex items-center gap-2 text-gray-600 text-xs">
            <div class="w-4 h-4 border-2 border-gray-600 border-t-red-500 rounded-full animate-spin"></div>
            Carregando mais canais…
          </div>
          <div v-else-if="visibleItems.length > 0" class="text-gray-700 text-xs">
            Todos os canais exibidos
          </div>
        </div>
        </div><!-- /gridZone -->
      </div>
    </div>

    <VideoPlayer
      v-if="activeChannel"
      :id="activeChannel.id"
      :url="activeChannel.url"
      :title="activeChannel.name"
      :poster="activeChannel.logo"
      :is-live="true"
      @close="activeChannel = null"
      @error="errorMsg = $event"
    />
  </div>
</template>


