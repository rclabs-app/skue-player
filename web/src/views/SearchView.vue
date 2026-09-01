<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlaylistStore } from '../stores/playlist'
import { cleanName } from '../utils/text'
import type { PlaylistItem, SeriesEntry } from '../types/m3u'
import VideoPlayer from '../components/VideoPlayer.vue'
import ContentCard from '../components/ContentCard.vue'

const router = useRouter()
const store = usePlaylistStore()
import { db } from '../lib/database'
import { useSpatialNav } from '../composables/useSpatialNav'

const nav = useSpatialNav()
const appSidebarZone = computed(() => document.querySelector('[data-tv-zone="sidebar"]') as HTMLElement | null)
nav.registerZone('sidebar', appSidebarZone, { defaultFocusSelector: '[data-route="search"]' })

const searchQuery = ref('')
const activeItem = ref<PlaylistItem | null>(null)
const errorMsg = ref('')

const isPageLoading = ref(true)

onMounted(async () => {
  if (!store.isLoaded) {
    router.push('/onboarding')
  }
  await new Promise(r => setTimeout(r, 400))
  isPageLoading.value = false
})

const results = ref<{ movies: PlaylistItem[], series: SeriesEntry[], live: PlaylistItem[] }>({
  movies: [],
  series: [],
  live: []
})

let searchTimeout: any = null

const isSearching = ref(false)

watch(searchQuery, (newVal) => {
  clearTimeout(searchTimeout)
  const q = newVal.trim().toLowerCase()
  
  if (!q) {
    isSearching.value = false
    results.value = { movies: [], series: [], live: [] }
    return
  }
  
  isSearching.value = true
  searchTimeout = setTimeout(async () => {
    
    const [movies, live] = await Promise.all([
      db.searchItemsByType(q, 'movie', 48),
      db.searchItemsByType(q, 'live', 48)
    ])
    
    // Series index is small and in memory
    const series = store.uniqueSeries
      .filter((s: any) => s.displayName.toLowerCase().includes(q) || cleanName(s.displayName).toLowerCase().includes(q))
      .slice(0, 48)

    results.value = { movies, series, live }
    isSearching.value = false
  }, 300)
})

function play(item: PlaylistItem | SeriesEntry) {
  const itemType = 'type' in item ? item.type : undefined
  if (itemType === 'movie' || itemType === 'series' || store.isSeriesId(item.id)) {
    router.push('/details/' + encodeURIComponent(item.id))
  } else {
    errorMsg.value = ''
    activeItem.value = item as PlaylistItem
  }
}
</script>

<template>
  <div v-if="store.isLoaded" class="h-full flex flex-col bg-[#0f171e] relative">
    
    <!-- Page Load State -->
    <div v-if="isPageLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-[#0f171e] z-50">
      <div class="w-12 h-12 border-4 border-gray-700 border-t-primary rounded-full animate-spin mb-4"></div>
      <p class="text-gray-400 font-medium">Carregando busca...</p>
    </div>
    
    <!-- Search Header -->
    <div class="px-8 pt-12 pb-6 border-b border-gray-800/60 sticky top-0 bg-[#0f171e]/90 backdrop-blur-md z-20">
      <div class="max-w-4xl mx-auto relative">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input 
          v-model="searchQuery" 
          type="text" 
          autofocus
          placeholder="Busque por filmes, séries, ou canais de TV..." 
          class="w-full bg-gray-900/80 text-white text-xl placeholder-gray-500 rounded-2xl py-4 pl-14 pr-6 border border-gray-700/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-xl"
        />
        <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white bg-gray-800 rounded-full p-1.5 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
    </div>

    <!-- Results Area -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-thin">
      
      <div v-if="!searchQuery" class="h-full flex flex-col items-center justify-center text-gray-500 opacity-60">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mb-4"><circle cx="11" cy="11" r="8"/><circle cx="21" cy="21" r="1"/></svg>
        <p class="text-xl">O que você quer assistir hoje?</p>
      </div>
      
      <div v-else-if="isSearching" class="h-full flex flex-col items-center justify-center text-gray-500">
        <div class="w-12 h-12 border-4 border-gray-700 border-t-primary rounded-full animate-spin mb-4"></div>
        <p class="text-xl">Buscando "{{ searchQuery }}"...</p>
      </div>
      
      <div v-else-if="results.movies.length === 0 && results.series.length === 0 && results.live.length === 0" class="h-full flex flex-col items-center justify-center text-gray-500">
        <p class="text-xl">Nenhum resultado encontrado para "{{ searchQuery }}"</p>
      </div>
      
      <div v-else class="space-y-12 max-w-[1600px] mx-auto pb-20">
        
        <!-- Movies -->
        <section v-if="results.movies.length > 0">
          <div class="flex items-center gap-3 mb-6">
            <h2 class="text-2xl font-bold text-white">Filmes</h2>
            <span class="bg-primary/20 text-primary text-xs font-bold px-2 py-1 rounded-full">{{ results.movies.length }}</span>
          </div>
          <div class="grid grid-cols-8 gap-4">
            <ContentCard
              v-for="item in results.movies.slice(0, 48)" 
              :key="item.id"
              :item="item"
              :is-portrait="true"
              :show-title="false"
              @play="play(item)"
            />
          </div>
        </section>

        <!-- Series -->
        <section v-if="results.series.length > 0">
          <div class="flex items-center gap-3 mb-6">
            <h2 class="text-2xl font-bold text-white">Séries</h2>
            <span class="bg-primary/20 text-primary text-xs font-bold px-2 py-1 rounded-full">{{ results.series.length }}</span>
          </div>
          <div class="grid grid-cols-8 gap-4">
            <ContentCard
              v-for="item in results.series.slice(0, 48)" 
              :key="item.id"
              :item="item"
              :is-portrait="true"
              :show-title="false"
              @play="play(item)"
            />
          </div>
        </section>

        <!-- Live TV -->
        <section v-if="results.live.length > 0">
          <div class="flex items-center gap-3 mb-6">
            <h2 class="text-2xl font-bold text-white">TV Ao Vivo</h2>
            <span class="bg-primary/20 text-primary text-xs font-bold px-2 py-1 rounded-full">{{ results.live.length }}</span>
          </div>
          <div class="grid grid-cols-8 gap-4">
            <ContentCard
              v-for="item in results.live.slice(0, 48)" 
              :key="item.id"
              :item="item"
              :is-portrait="true"
              :show-title="false"
              @play="play(item)"
            />
          </div>
        </section>

      </div>
    </div>
    
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
.card-portrait {
  cursor: pointer;
  position: relative;
  overflow: hidden;
  background: rgba(17,24,39,0.8);
  border: 1px solid rgba(55,65,81,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  aspect-ratio: 2/3;
}
.card-portrait:hover {
  transform: scale(1.04);
  border-color: rgba(59,130,246,0.6);
  box-shadow: 0 8px 30px rgba(59,130,246,0.15);
  z-index: 10;
}
</style>
