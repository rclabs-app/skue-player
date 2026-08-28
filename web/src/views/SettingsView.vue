<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlaylistStore } from '../stores/playlist'
import { useHistoryStore } from '../stores/history'
import { useFavoritesStore } from '../stores/favorites'
import { db } from '../lib/database'
import { getDeviceMac } from '../utils/device'
import { EPGService } from '../services/epg.service'
import { buildPlaylistUrl } from '../utils/playlist'

const router = useRouter()
const store = usePlaylistStore()
const historyStore = useHistoryStore()
const favoritesStore = useFavoritesStore()

// ── State ─────────────────────────────────────────────────────
const playlistUrl = ref<string | null>(null)
const showClearConfirm = ref(false)
const showHistoryConfirm = ref(false)
const clearingHistory = ref(false)
const notification = ref<{ msg: string; type: 'success' | 'error' } | null>(null)

// EPG State
const epgUrl = ref<string | null>(null)
const showEpgUrlInput = ref(false)
const newEpgUrl = ref('')
const epgUpdateError = ref('')

// Remote Activation State
const deviceMac = ref('')
const devicePlaylists = ref<any[]>([])
const isSyncingPortal = ref(false)

// ── Computed ───────────────────────────────────────────────────
const totalMovies = ref(0)
const totalSeries = ref(0)
const totalLive = ref(0)

const totalContent = computed(
  () => totalMovies.value + totalSeries.value + totalLive.value
)
const isSyncingEpg = computed(() => store.isProcessing || EPGService.isSyncing)
const epgSyncStatus = computed(() => store.epgSyncStatus)

const appVersion = '0.3.0'

// ── Lifecycle ─────────────────────────────────────────────────
onMounted(async () => {
  playlistUrl.value = await db.getConfig('playlist_url')
  epgUrl.value = await db.getConfig('epg_url')
  await historyStore.loadHistory()
  await favoritesStore.loadFavorites()
  
  if (store.isLoaded) {
    totalMovies.value = await db.getPlaylistItemCount('movie')
    totalSeries.value = await db.getSeriesIndexCount()
    totalLive.value = await db.getPlaylistItemCount('live')
  }
  
  deviceMac.value = store.deviceMac || (await getDeviceMac())
  try {
    devicePlaylists.value = await store.fetchDeviceConfig()
  } catch (e) {
    console.error('Failed to load remote configs on settings mount', e)
  }
})

// ── Actions ───────────────────────────────────────────────────
async function syncCurrentEpg() {
  if (!epgUrl.value) return
  try {
    await store.syncEpg(epgUrl.value)
    showNotification('EPG sincronizado com sucesso!')
  } catch (e) {
    showNotification('Falha ao sincronizar EPG.', 'error')
  }
}

async function updateEpgUrl() {
  const urlVal = newEpgUrl.value.trim()
  epgUpdateError.value = ''
  if (!urlVal) {
    epgUpdateError.value = 'Informe uma URL de EPG válida.'
    return
  }
  try {
    await store.syncEpg(urlVal)
    await db.saveConfig('epg_url', urlVal)
    epgUrl.value = urlVal
    showEpgUrlInput.value = false
    newEpgUrl.value = ''
    showNotification('Guia EPG configurado e sincronizado!')
  } catch (e: any) {
    epgUpdateError.value = e.message || 'Falha ao sincronizar o EPG desta URL.'
  }
}

async function clearEpg() {
  try {
    await db.saveConfig('epg_url', null)
    await db.clearEpg()
    epgUrl.value = null
    store.epgUrl = null
    store.epgSyncStatus = ''
    showNotification('Guia EPG removido!')
  } catch (e) {
    showNotification('Erro ao remover EPG.', 'error')
  }
}

async function syncPortal() {
  isSyncingPortal.value = true
  try {
    await store.syncHandshake()
    const configs = await store.fetchDeviceConfig()
    devicePlaylists.value = configs
    showNotification('Dispositivo sincronizado com o portal!')
  } catch (e) {
    showNotification('Falha ao sincronizar com o portal.', 'error')
  } finally {
    isSyncingPortal.value = false
  }
}

async function activateRemotePlaylist(playlist: any) {
  isSyncingPortal.value = true
  try {
    const targetUrl = buildPlaylistUrl(playlist)

    await store.loadPlaylistFromUrl(targetUrl)
    playlistUrl.value = targetUrl
    showNotification(`Lista "${playlist.name}" carregada com sucesso!`)
  } catch (e) {
    showNotification('Erro ao carregar a lista do portal.', 'error')
  } finally {
    isSyncingPortal.value = false
  }
}
function showNotification(msg: string, type: 'success' | 'error' = 'success') {
  notification.value = { msg, type }
  setTimeout(() => (notification.value = null), 3500)
}

async function clearHistory() {
  clearingHistory.value = true
  try {
    await db.clearHistory()
    historyStore.historyItems.splice(0)
    showHistoryConfirm.value = false
    showNotification('Histórico limpo!')
  } catch {
    showNotification('Erro ao limpar histórico.', 'error')
  }
  clearingHistory.value = false
}

function clearAllData() {
  store.clearPlaylist()
  showClearConfirm.value = false
  router.push('/onboarding')
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.password) u.password = '***'
    if (u.username) u.username = u.username.substring(0, 3) + '***'
    return u.toString()
  } catch {
    return url.length > 60 ? url.substring(0, 60) + '...' : url
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-[#0f171e] overflow-hidden">

    <!-- ── Notification Toast ── -->
    <Transition name="toast">
      <div
        v-if="notification"
        :class="[
          'fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 text-sm font-medium border',
          notification.type === 'success'
            ? 'bg-green-900/90 border-green-700 text-green-200'
            : 'bg-red-900/90 border-red-700 text-red-200'
        ]"
      >
        <svg v-if="notification.type === 'success'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        {{ notification.msg }}
      </div>
    </Transition>

    <!-- ── Header (compact) ── -->
    <div class="flex items-center gap-3 px-8 pt-6 pb-4 shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary shrink-0">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>
      </svg>
      <h1 class="text-white font-bold text-xl tracking-wide">Configurações</h1>
      <span class="text-gray-600 text-sm ml-1">Gerencie sua playlist, dados locais e preferências.</span>
    </div>

    <!-- ── Stats row ── -->
    <div v-if="store.isLoaded" class="grid grid-cols-4 gap-3 px-8 pb-4 shrink-0">
      <div class="stat-card">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary mb-1"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>
        <span class="stat-value">{{ totalMovies.toLocaleString('pt-BR') }}</span>
        <span class="stat-label">Filmes</span>
      </div>
      <div class="stat-card">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary mb-1"><path d="M4 10h16"/><path d="M4 14h16"/><rect width="16" height="16" x="4" y="4" rx="2"/></svg>
        <span class="stat-value">{{ totalSeries.toLocaleString('pt-BR') }}</span>
        <span class="stat-label">Séries</span>
      </div>
      <div class="stat-card">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-400 mb-1"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
        <span class="stat-value">{{ totalLive.toLocaleString('pt-BR') }}</span>
        <span class="stat-label">Canais AO VIVO</span>
      </div>
      <div class="stat-card">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-yellow-400 mb-1"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        <span class="stat-value">{{ favoritesStore.favoriteIds.length.toLocaleString('pt-BR') }}</span>
        <span class="stat-label">Favoritos</span>
      </div>
    </div>

    <!-- ── Main grid: 2 columns ── -->
    <div class="flex-1 grid grid-cols-2 gap-4 px-8 pb-6 min-h-0">

      <!-- ════ LEFT COLUMN ════ -->
      <div class="flex flex-col gap-4 min-h-0">


        <!-- Guia de Programação (EPG) -->
        <section class="flex flex-col min-h-0">
          <h2 class="settings-section-title">Guia de Programação (EPG)</h2>
          <div class="settings-card flex flex-col gap-3">
            <!-- URL atual -->
            <div>
              <p class="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-semibold">URL do Guia (XMLTV)</p>
              <div v-if="epgUrl" class="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 border border-gray-700/60">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-gray-500 shrink-0"><path d="M4 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M20 5A16 16 0 0 0 4 5"/><path d="M15.5 9.5A11 11 0 0 0 4 9.5"/><path d="M11 14A6 6 0 0 0 4 14"/></svg>
                <code class="text-gray-300 text-[11px] break-all flex-1 font-mono leading-tight">{{ maskUrl(epgUrl) }}</code>
              </div>
              <div v-else class="text-gray-500 text-xs italic">
                Nenhuma URL de EPG configurada.
              </div>
            </div>

            <!-- Status de Sincronização -->
            <div v-if="epgSyncStatus" class="bg-black/20 rounded-lg p-2.5 border border-gray-800/40">
              <p class="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5 font-semibold">Status de Sincronização</p>
              <p class="text-gray-300 text-xs flex items-center gap-2">
                <span v-if="isSyncingEpg" class="w-3.5 h-3.5 border-2 border-gray-600 border-t-primary rounded-full animate-spin shrink-0"></span>
                {{ epgSyncStatus }}
              </p>
            </div>

            <!-- Ações -->
            <div class="flex flex-wrap gap-2">
              <button
                v-if="epgUrl && !store.isProcessing"
                @click="syncCurrentEpg"
                :disabled="isSyncingEpg"
                class="settings-btn-primary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="['shrink-0', isSyncingEpg ? 'animate-spin' : '']"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                {{ isSyncingEpg ? 'Atualizando...' : 'Atualizar Guia' }}
              </button>
              <button
                v-if="!showEpgUrlInput"
                @click="showEpgUrlInput = true; newEpgUrl = epgUrl || ''"
                class="settings-btn-secondary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                {{ epgUrl ? 'Trocar URL EPG' : 'Configurar EPG' }}
              </button>
              <button
                v-if="epgUrl && !showEpgUrlInput"
                @click="clearEpg"
                class="settings-btn-danger"
              >
                Remover Guia
              </button>
            </div>

            <!-- Input nova URL EPG -->
            <div v-if="showEpgUrlInput" class="mt-2 space-y-2">
              <input
                v-model="newEpgUrl"
                type="url"
                placeholder="http://servidor.com/epg.xml"
                class="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs placeholder-gray-600 focus:border-primary focus:outline-none transition-colors"
                @keyup.enter="updateEpgUrl"
              />
              <p v-if="epgUpdateError" class="text-red-400 text-[11px]">{{ epgUpdateError }}</p>
              <div class="flex gap-2">
                <button @click="updateEpgUrl" :disabled="isSyncingEpg" class="settings-btn-primary">
                  {{ isSyncingEpg ? 'Carregando...' : 'Confirmar' }}
                </button>
                <button @click="showEpgUrlInput = false; epgUpdateError = ''" class="settings-btn-secondary">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Sobre o RC Player -->
        <section class="shrink-0">
          <h2 class="settings-section-title">Sobre o RC Player</h2>
          <div class="settings-card">
            <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm mb-3">
              <div class="flex items-center justify-between">
                <span class="text-gray-500 text-xs">Versão</span>
                <span class="text-white font-mono text-xs font-medium">v{{ appVersion }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-gray-500 text-xs">Plataforma</span>
                <span class="text-white text-xs">Web / Smart TV</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-gray-500 text-xs">Armazenamento</span>
                <span class="text-white text-xs">Local (SQLite WASM)</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-gray-500 text-xs">Total de conteúdos</span>
                <span class="text-white font-mono text-xs">{{ totalContent.toLocaleString('pt-BR') }}</span>
              </div>
            </div>
            <div class="border-t border-gray-800 pt-2 text-[11px] text-gray-600 leading-relaxed">
              O RC Player é um reprodutor local-first. Nenhum conteúdo é armazenado ou transmitido por nossos servidores. O usuário é responsável pela legalidade das fontes utilizadas.
            </div>
          </div>
        </section>
      </div>

      <!-- ════ RIGHT COLUMN ════ -->
      <div class="flex flex-col gap-4 min-h-0">

        <!-- Ativação & Listas do Portal -->
        <section class="shrink-0">
          <h2 class="settings-section-title">Ativação & Listas do Portal</h2>
          <div class="settings-card space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5 font-semibold">Endereço MAC Virtual</p>
                <p class="text-white font-mono text-sm font-bold">{{ deviceMac }}</p>
              </div>
              <button 
                @click="syncPortal"
                :disabled="isSyncingPortal"
                class="settings-btn-primary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{'animate-spin': isSyncingPortal}" class="shrink-0"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                Sincronizar
              </button>
            </div>

            <!-- List of remote playlists -->
            <div class="border-t border-gray-800/80 pt-3">
              <p class="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">Listas no Portal</p>
              <div v-if="devicePlaylists.length === 0" class="text-gray-500 text-xs italic">
                Nenhuma lista configurada no portal remoto. Cadastre em <strong class="text-gray-300">rcplayer.tv/portal</strong> usando seu MAC.
              </div>
              <div v-else class="space-y-2 max-h-48 overflow-y-auto pr-1">
                <div 
                  v-for="playlist in devicePlaylists" 
                  :key="playlist.id"
                  :class="[
                    'flex items-center justify-between rounded-lg p-2.5 transition-all',
                    Boolean(playlistUrl && playlistUrl === buildPlaylistUrl(playlist))
                      ? 'bg-primary/10 border border-primary/30'
                      : 'bg-black/20 hover:bg-black/40 border border-gray-800/50'
                  ]"
                >
                  <div class="min-w-0 flex-1 pr-3">
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-bold text-white truncate">{{ playlist.name }}</span>
                      <span class="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded">
                        {{ playlist.type }}
                      </span>
                      <span 
                        v-if="Boolean(playlistUrl && playlistUrl === buildPlaylistUrl(playlist))"
                        class="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded"
                      >
                        Carregada
                      </span>
                    </div>
                    <span class="text-[10px] text-gray-500 truncate block mt-0.5 font-mono">{{ playlist.url }}</span>
                  </div>
                  
                  <button 
                    @click="activateRemotePlaylist(playlist)"
                    :disabled="Boolean(isSyncingPortal || (playlistUrl && playlistUrl === buildPlaylistUrl(playlist)))"
                    :class="[
                      '!py-1 !px-2.5 !text-[11px]',
                      Boolean(playlistUrl && playlistUrl === buildPlaylistUrl(playlist)) ? 'settings-btn-primary opacity-50 cursor-not-allowed' : 'settings-btn-secondary'
                    ]"
                  >
                    {{ Boolean(playlistUrl && playlistUrl === buildPlaylistUrl(playlist)) ? 'Ativa' : 'Carregar' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Histórico de Reprodução -->
        <section class="shrink-0">
          <h2 class="settings-section-title">Histórico de Reprodução</h2>
          <div class="settings-card">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-white font-medium text-sm">Itens no histórico</p>
                <p class="text-gray-500 text-xs mt-0.5">
                  {{ historyStore.historyItems.length }} título(s) assistido(s) ·
                  {{ historyStore.activelyWatching.length }} em andamento
                </p>
              </div>
              <button
                v-if="historyStore.historyItems.length > 0"
                @click="showHistoryConfirm = true"
                class="settings-btn-danger"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                Limpar
              </button>
              <p v-else class="text-gray-600 text-xs italic">Nenhum histórico.</p>
            </div>

            <!-- Confirm limpar histórico -->
            <div v-if="showHistoryConfirm" class="mt-3 bg-orange-950/50 border border-orange-800/60 rounded-lg p-3">
              <p class="text-orange-200 text-xs font-medium mb-2">Tem certeza? Seu progresso de reprodução será perdido.</p>
              <div class="flex gap-2">
                <button @click="clearHistory" :disabled="clearingHistory" class="px-3 py-1.5 bg-orange-700 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors">
                  {{ clearingHistory ? 'Limpando...' : 'Sim, limpar' }}
                </button>
                <button @click="showHistoryConfirm = false" class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Zona de Perigo -->
        <section class="shrink-0">
          <h2 class="settings-section-title text-red-500/80">Zona de Perigo</h2>
          <div class="settings-card border-red-900/50">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-white font-medium text-sm">Limpar todos os dados</p>
                <p class="text-gray-500 text-xs mt-0.5">Remove playlist, histórico e favoritos. Redireciona para a tela inicial.</p>
              </div>
              <button
                @click="showClearConfirm = true"
                class="settings-btn-danger shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                Limpar Tudo
              </button>
            </div>

            <div v-if="showClearConfirm" class="mt-3 bg-red-950/50 border border-red-800/60 rounded-lg p-3">
              <p class="text-red-200 text-xs font-medium mb-1">Ação irreversível</p>
              <p class="text-red-300/70 text-[11px] mb-2">Todos os dados locais serão apagados permanentemente.</p>
              <div class="flex gap-2">
                <button @click="clearAllData" class="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors">
                  Apagar tudo
                </button>
                <button @click="showClearConfirm = false" class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Spacer to push content up -->
        <div class="flex-1"></div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* ── Section title ── */
.settings-section-title {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

/* ── Card ── */
.settings-card {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(55, 65, 81, 0.6);
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
}

/* ── Stat card ── */
.stat-card {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(55, 65, 81, 0.5);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.stat-value {
  font-size: 1.35rem;
  font-weight: 800;
  color: white;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  margin-bottom: 0.15rem;
}
.stat-label {
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6b7280;
}

/* ── Buttons ── */
.settings-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.85rem;
  background: #2563eb;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 0.5rem;
  transition: all 0.2s;
}
.settings-btn-primary:hover:not(:disabled) { background: #1d4ed8; transform: scale(1.02); }
.settings-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.settings-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.85rem;
  background: rgba(55, 65, 81, 0.5);
  color: #d1d5db;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 0.5rem;
  border: 1px solid rgba(75, 85, 99, 0.5);
  transition: all 0.2s;
}
.settings-btn-secondary:hover { background: rgba(75, 85, 99, 0.6); color: white; }

.settings-btn-danger {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  background: rgba(127, 29, 29, 0.4);
  color: #fca5a5;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 0.5rem;
  border: 1px solid rgba(153, 27, 27, 0.5);
  transition: all 0.2s;
}
.settings-btn-danger:hover { background: rgba(153, 27, 27, 0.6); color: #fecaca; }

/* ── Toast transition ── */
.toast-enter-active { transition: all 0.3s ease; }
.toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from { opacity: 0; transform: translate(-50%, -12px); }
.toast-leave-to   { opacity: 0; transform: translate(-50%, -8px); }
</style>
