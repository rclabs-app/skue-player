<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { usePlaylistStore } from '../stores/playlist'
import VideoPlayer from '../components/VideoPlayer.vue'
import { db } from '../lib/database'
import type { EPGProgram } from '../types/epg'
import type { PlaylistItem } from '../types/m3u'

const store = usePlaylistStore()
const channels = ref<PlaylistItem[]>([])

const selectedChannel = ref<PlaylistItem | null>(null)
const isPlaying = ref(false)
const epgData = ref<Record<string, EPGProgram[]>>({})
const selectedProgramDetail = ref<{ channel: any; program: EPGProgram } | null>(null)

// Current time and rounding to starting half-hour
const timelineStart = computed(() => {
  const d = new Date()
  d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0)
  return d
})

const timelineEnd = computed(() => {
  return new Date(timelineStart.value.getTime() + 4 * 60 * 60 * 1000) // 4 hours window
})

// Hours intervals for the header (8 intervals of 30 mins)
const hours = computed(() => {
  const times = []
  const start = new Date(timelineStart.value)
  for (let i = 0; i < 8; i++) {
    const d = new Date(start)
    d.setMinutes(start.getMinutes() + i * 30)
    times.push(d)
  }
  return times
})

function formatTime(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatHour(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function playChannel(c: any) {
  selectedChannel.value = c
  isPlaying.value = true
}

// Fetch EPG for channels on mount
onMounted(() => {
  if (store.isLoaded) {
    loadGuideEpg()
  }
})

// Reload EPG if channels list is loaded
watch(() => store.isLoaded, (loaded) => {
  if (loaded) {
    loadGuideEpg()
  }
})

async function loadGuideEpg() {
  const loadedChannels = await db.getPlaylistItems('live', 50, 0)
  channels.value = loadedChannels
  
  const data: Record<string, EPGProgram[]> = {}
  for (const c of channels.value) {
    try {
      let programs = await db.getEpgPrograms(c.id)
      if (programs.length === 0) {
        programs = await db.getEpgPrograms(c.name)
      }
      
      if (programs.length === 0) {
        programs = generateMockGuidePrograms(c.id, c.name, c.group)
      }
      
      data[c.id] = programs
    } catch (e) {
      console.error('Failed to load EPG for guide:', e)
    }
  }
  epgData.value = data
}

function generateMockGuidePrograms(channelId: string, channelName: string, channelGroup = ''): EPGProgram[] {
  const list: EPGProgram[] = []
  const hash = channelName.length
  
  const now = new Date()
  const start = new Date(now)
  start.setHours(start.getHours() - 2, 0, 0, 0)
  
  let currentStart = new Date(start)
  for (let i = 0; i < 12; i++) {
    const durationMins = 30 + ((hash + i * 17) % 90)
    const currentEnd = new Date(currentStart)
    currentEnd.setMinutes(currentStart.getMinutes() + durationMins)
    
    list.push({
      id: `${channelId}_mock_${i}_${currentStart.getTime()}`,
      channelId,
      title: getMockTitle(channelName, channelGroup, i),
      description: `Programação simulada para o canal ${channelName}. Quando um arquivo XMLTV real for associado e sincronizado, a grade de programação será atualizada de forma 100% dinâmica.`,
      startTime: new Date(currentStart),
      endTime: new Date(currentEnd)
    })
    
    currentStart = new Date(currentEnd)
  }
  
  return list
}

function getMockTitle(name: string, group: string, index: number): string {
  const category = group || 'Geral'
  const titles = [
    `Jornal da ${name}`,
    `Cine ${category}`,
    `Série Especial`,
    `Futebol ao Vivo`,
    `Documentário ${category}`,
    `Talk Show da Noite`,
    `Notícias do Dia`,
    `Festival de Filmes`,
    `Desenhos Animados`,
    `Esporte Alternativo`
  ]
  return titles[index % titles.length]
}

// Filter programs to show only those overlapping the 4 hours window
function getVisibleProgramsForChannel(channelId: string): EPGProgram[] {
  const programs = epgData.value[channelId] || []
  const tStart = timelineStart.value.getTime()
  const tEnd = timelineEnd.value.getTime()
  
  return programs.filter(p => {
    return p.endTime.getTime() > tStart && p.startTime.getTime() < tEnd
  })
}

// Calculate left position (px) based on 1200px timeline width
function getProgLeft(p: EPGProgram): number {
  const tStart = timelineStart.value.getTime()
  const pStart = Math.max(p.startTime.getTime(), tStart)
  const diffMs = pStart - tStart
  const totalMs = 4 * 60 * 60 * 1000 // 4 hours
  return (diffMs / totalMs) * 1200
}

// Calculate width (px) based on 1200px timeline width
function getProgWidth(p: EPGProgram): number {
  const tStart = timelineStart.value.getTime()
  const tEnd = timelineEnd.value.getTime()
  const pStart = Math.max(p.startTime.getTime(), tStart)
  const pEnd = Math.min(p.endTime.getTime(), tEnd)
  const diffMs = pEnd - pStart
  const totalMs = 4 * 60 * 60 * 1000 // 4 hours
  return Math.max((diffMs / totalMs) * 1200, 10) // min 10px
}

function showProgramDetail(channel: any, program: EPGProgram) {
  selectedProgramDetail.value = { channel, program }
}

function isProgramCurrent(p: EPGProgram): boolean {
  const now = new Date().getTime()
  return p.startTime.getTime() <= now && p.endTime.getTime() > now
}

function playChannelFromDetail() {
  if (selectedProgramDetail.value) {
    selectedChannel.value = selectedProgramDetail.value.channel
    isPlaying.value = true
    selectedProgramDetail.value = null
  }
}
</script>

<template>
  <div class="flex flex-col h-full bg-[#0a0a0a] text-white overflow-hidden">
    <!-- Header -->
    <div class="px-8 py-6 border-b border-gray-800 shrink-0 bg-black/50 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold">Guia de Programação</h1>
        <p class="text-gray-400 text-sm mt-1">Grade clássica com sincronização de EPG local</p>
      </div>
      <div v-if="store.epgUrl" class="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2">
        <span class="text-xs text-gray-400 font-medium">EPG XMLTV ativo:</span>
        <button
          @click="store.syncCurrentEpg"
          class="bg-primary/20 hover:bg-primary/45 border border-primary/30 text-primary hover:text-white px-3 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin-slow"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Sincronizar
        </button>
        <span v-if="store.epgSyncStatus" class="text-xs text-gray-500 max-w-[200px] truncate">{{ store.epgSyncStatus }}</span>
      </div>
    </div>

    <!-- Timeline Grid -->
    <div class="flex-1 overflow-auto relative scrollbar-thin">
      <div class="w-[1456px] select-none">
        <!-- Header: Horários -->
        <div class="flex sticky top-0 z-20 bg-gray-950 border-b border-gray-800/80">
          <div class="w-64 shrink-0 px-4 py-3 bg-gray-950 border-r border-gray-800 font-bold text-gray-400">Canais</div>
          <div class="w-[1200px] flex relative shrink-0">
            <div v-for="h in hours" :key="h.getTime()" class="w-[150px] px-3 py-3 border-r border-gray-800/40 text-xs font-semibold text-gray-400 shrink-0">
              {{ formatHour(h) }}
            </div>
          </div>
        </div>

        <!-- Linhas: Canais -->
        <div v-for="channel in channels" :key="channel.id" class="flex border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors group">
          <!-- Nome do Canal e Logo -->
          <div class="w-64 shrink-0 px-4 py-3 flex items-center gap-3 bg-gray-950/40 border-r border-gray-800 cursor-pointer group-hover:bg-gray-800/60 transition-colors" @click="playChannel(channel)">
            <img v-if="channel.logo" :src="channel.logo" class="w-10 h-10 object-contain bg-black/50 rounded border border-gray-800/50 p-1" @error="(e) => (e.target as HTMLImageElement).style.display='none'" />
            <div v-else class="w-10 h-10 bg-gray-800 rounded flex-shrink-0 flex items-center justify-center text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
            </div>
            <span class="truncate text-xs font-semibold text-gray-200">{{ channel.name }}</span>
          </div>
          
          <!-- Program Timeline Area -->
          <div class="relative w-[1200px] h-[64px] bg-gray-900/10 shrink-0 overflow-hidden">
            <div
              v-for="prog in getVisibleProgramsForChannel(channel.id)"
              :key="prog.id"
              class="absolute top-2 h-[48px] rounded px-3 py-1.5 flex flex-col justify-center transition-colors select-none text-left border border-gray-850/80 bg-gray-900/40 hover:bg-gray-800/80 cursor-pointer"
              :class="[
                isProgramCurrent(prog) ? 'border-primary/40 bg-primary/5 hover:bg-primary/10' : ''
              ]"
              :style="{
                left: getProgLeft(prog) + 'px',
                width: getProgWidth(prog) - 2 + 'px'
              }"
              @click="showProgramDetail(channel, prog)"
            >
              <span class="text-xs font-bold text-white truncate w-full" :class="[isProgramCurrent(prog) ? 'text-primary' : '']">{{ prog.title }}</span>
              <span class="text-[10px] text-gray-500 truncate w-full mt-0.5">
                {{ formatTime(prog.startTime) }} - {{ formatTime(prog.endTime) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Program Detail Modal -->
    <div v-if="selectedProgramDetail" class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div class="bg-gray-900 border border-gray-850 rounded-xl max-w-lg w-full p-6 relative overflow-hidden shadow-2xl">
        <button @click="selectedProgramDetail = null" class="absolute top-4 right-4 text-gray-400 hover:text-white text-lg">✕</button>
        
        <div class="flex gap-4 items-center mb-4">
          <img v-if="selectedProgramDetail.channel.logo" :src="selectedProgramDetail.channel.logo" class="w-12 h-12 object-contain bg-black/50 rounded p-1 border border-gray-800" />
          <div>
            <h4 class="text-gray-500 text-xs font-semibold uppercase tracking-wider">{{ selectedProgramDetail.channel.name }}</h4>
            <h3 class="text-white text-xl font-bold mt-0.5">{{ selectedProgramDetail.program.title }}</h3>
          </div>
        </div>

        <div class="flex items-center gap-3 text-sm text-gray-400 mb-4">
          <span class="bg-gray-850 px-2.5 py-0.5 rounded text-gray-300 border border-gray-700/50">
            {{ formatTime(selectedProgramDetail.program.startTime) }} - {{ formatTime(selectedProgramDetail.program.endTime) }}
          </span>
          <span v-if="isProgramCurrent(selectedProgramDetail.program)" class="text-xs uppercase tracking-wider text-green-400 font-bold bg-green-400/10 px-2 py-0.5 rounded">No Ar</span>
        </div>

        <p class="text-gray-300 text-sm leading-relaxed mb-6">{{ selectedProgramDetail.program.description || 'Sem descrição detalhada.' }}</p>

        <div class="flex gap-3 justify-end">
          <button @click="selectedProgramDetail = null" class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-lg text-xs transition-colors">
            Fechar
          </button>
          <button @click="playChannelFromDetail" class="px-5 py-2 bg-primary hover:bg-blue-600 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95 shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Assistir Canal
          </button>
        </div>
      </div>
    </div>

    <!-- Video Player Overlay -->
    <VideoPlayer
      v-if="isPlaying && selectedChannel"
      :id="selectedChannel.id"
      :url="selectedChannel.url"
      :title="selectedChannel.name"
      :poster="selectedChannel.logo"
      :is-live="true"
      @close="isPlaying = false"
    />
  </div>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 3px; }
.scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #374151; }
</style>
