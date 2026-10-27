<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlaylistStore } from '../stores/playlist'
import { buildPlaylistUrl } from '../utils/playlist'
import QrcodeVue from 'qrcode.vue'

const portalUrl = computed(() => {
  return typeof window !== 'undefined' ? `${window.location.origin}/portal` : 'https://skue.tv/portal'
})

const router = useRouter()
const store = usePlaylistStore()

const error = ref('')

// Device Activation (MAC Address + Key)
const deviceMac = ref('')
const activationKey = ref('')
const isWaiting = ref(false)
let pollingInterval: number | null = null

async function requestActivation() {
  try {
    error.value = ''
    isWaiting.value = true
    
    // Ensure store is initialized to generate/fetch MAC address
    if (!store.deviceMac) {
      await store.initialize()
    }
    deviceMac.value = store.deviceMac

    const data = await store.syncHandshake()
    activationKey.value = data.device_key
    
    // If device already has playlists registered, boot immediately
    if (data.playlists_count > 0) {
      await checkRemotePlaylists()
      return
    }

    startPolling()
  } catch (e) {
    error.value = 'Erro de conexão ao gerar chave de ativação.'
    isWaiting.value = false
  }
}

let currentPollingInterval = 4000
const MAX_POLLING_INTERVAL = 120000 // 2 minutes

function startPolling() {
  if (pollingInterval) clearTimeout(pollingInterval)
  
  currentPollingInterval = 4000
  
  const poll = async () => {
    await checkRemotePlaylists()
    
    // Exponential backoff
    currentPollingInterval = Math.min(currentPollingInterval * 1.5, MAX_POLLING_INTERVAL)
    
    // Only continue polling if not stopped
    if (isWaiting.value) {
      pollingInterval = window.setTimeout(poll, currentPollingInterval)
    }
  }
  
  pollingInterval = window.setTimeout(poll, currentPollingInterval)
}

async function checkRemotePlaylists() {
  try {
    const playlists = await store.fetchDeviceConfig()
    if (playlists && playlists.length > 0) {
      stopPolling()
      
      // Load first active playlist
      const active = playlists.find((p: any) => p.is_active) || playlists[0]
      const targetUrl = buildPlaylistUrl(active)
      
      await handleUrlLoad(targetUrl)
    }
  } catch (e) {
    console.error('Polling error:', e)
  }
}

function stopPolling() {
  isWaiting.value = false
  if (pollingInterval) {
    clearTimeout(pollingInterval)
    pollingInterval = null
  }
}

async function handleUrlLoad(url: string) {
  if (!url) {
    error.value = 'Please enter a valid URL'
    return
  }
  
  error.value = ''
  try {
    await store.loadPlaylistFromUrl(url)
    router.push('/')
  } catch (e: any) {
    if (e.message === 'Failed to fetch' || e.message.includes('NetworkError')) {
      error.value = 'Network error: The URL is invalid or blocks CORS requests.'
    } else {
      error.value = store.error || 'Failed to load playlist'
    }
  }
}

onMounted(async () => {
  try {
    await store.initialize()
    await requestActivation()
  } finally {
    if (typeof (window as any).hideCustomSplash === 'function') {
      (window as any).hideCustomSplash()
    }
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0c] text-white p-4">
    <div class="bg-surface p-6 sm:p-8 rounded-2xl shadow-2xl max-w-md w-full my-auto border border-gray-800 text-center">
      
      <!-- Brand & Header -->
      <div class="mb-5 flex flex-col items-center">
        <img src="/skue-logo.svg" alt="Skue - See More" class="h-16 w-auto mb-2 filter drop-shadow-[0_4px_16px_rgba(0,240,255,0.25)]" />
        <p class="text-xs text-gray-400">Configure sua lista para começar a assistir</p>
      </div>
      
      <div v-if="error" class="bg-red-900/50 border border-red-700 text-red-200 px-3 py-2 rounded mb-4 text-xs">
        {{ error }}
      </div>

      <!-- Activation Info -->
      <div class="space-y-5">
        <p class="text-xs text-gray-300 bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 leading-relaxed">
          Acesse <strong class="text-white text-sm">skue.tv/portal</strong> ou escaneie o QR Code para adicionar suas listas IPTV:
        </p>
        
        <div class="flex justify-center">
          <div class="bg-white p-3 rounded-xl shadow-lg inline-block">
             <qrcode-vue :value="portalUrl" :size="140" level="M" render-as="svg" />
          </div>
        </div>

        <div class="space-y-4 bg-background rounded-xl p-5 border border-gray-700 shadow-inner">
          <!-- MAC Address -->
          <div>
            <span class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold block mb-1">Endereço MAC da TV</span>
            <div class="text-xl font-mono font-bold text-primary tracking-wider">
              {{ deviceMac || 'Carregando...' }}
            </div>
          </div>
          
          <div class="border-t border-gray-800 my-2"></div>

          <!-- Activation Key -->
          <div>
            <span class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold block mb-1">Chave de Ativação (Key)</span>
            <div v-if="activationKey" class="text-3xl font-mono font-extrabold text-white tracking-[0.15em] drop-shadow-md">
              {{ activationKey }}
            </div>
            <div v-else class="flex justify-center items-center py-2">
              <div class="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="mt-5">
        <button 
          @click="requestActivation" 
          class="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 px-4 rounded-lg transition-colors flex justify-center items-center gap-2 text-xs"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Recarregar Conexão
        </button>
      </div>

      <div class="mt-4">
        <p v-if="isWaiting" class="text-[11px] text-gray-500 flex items-center justify-center gap-2">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Aguardando configuração remota...
        </p>
        <p v-else class="text-[11px] text-red-500/80 flex items-center justify-center gap-2">
          Desconectado do serviço de ativação.
        </p>
      </div>
      
      <div v-if="store.isLoaded" class="mt-6 pt-4 border-t border-gray-800/50">
        <button @click="router.push('/')" class="text-[12px] text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Voltar para a página inicial
        </button>
      </div>
      
    </div>
  </div>
</template>
