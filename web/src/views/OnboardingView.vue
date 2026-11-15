<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlaylistStore } from '../stores/playlist'
import type { PlaylistConfig } from '../utils/playlist'
import QrcodeVue from 'qrcode.vue'
import { getPortalUrl } from '../utils/portal'

const portalUrl = computed(getPortalUrl)

const router = useRouter()
const store = usePlaylistStore()

const error = ref('')
const downloadDiagnostic = computed(() => {
  const diagnostic = store.downloadDiagnostics
  if (!diagnostic) return ''
  const direct = diagnostic.directStatus
    ? `HTTP ${diagnostic.directStatus}`
    : ({
      pending: 'sem resposta', 'mixed-content': 'HTTP bloqueado pelo navegador',
      response: 'sem resposta', 'network-error': 'falha de conexão', timeout: 'tempo esgotado',
    }[diagnostic.direct])
  const proxy = diagnostic.proxyAttempted
    ? ` Servidor: ${diagnostic.proxyStatus ? `HTTP ${diagnostic.proxyStatus}` : 'sem resposta'}.`
    : ''
  return `Direto no aparelho: ${direct}.${proxy}`
})

// Device Activation (MAC Address + Key)
const deviceMac = ref('')
const activationKey = computed(() => store.deviceRemoved ? '' : store.deviceKey)
const isWaiting = ref(false)
const isConnected = ref(false)
let pollingInterval: number | null = null

async function requestActivation(retryPlaylist = true) {
  try {
    error.value = ''
    isWaiting.value = true
    
    // Ensure store is initialized to generate/fetch MAC address
    if (!store.deviceMac) {
      await store.initialize()
    }
    deviceMac.value = store.deviceMac

    const data = await store.syncHandshake()
    isConnected.value = true
    
    // If device already has playlists registered, boot immediately
    if (data.playlists_count > 0) {
      // The router already attempted initialization. Preserve its import error
      // instead of immediately repeating a failed request on entering this view.
      if (!retryPlaylist && store.error) {
        error.value = store.error
        isWaiting.value = false
        return
      }
      await checkRemotePlaylists()
      return
    }

    startPolling()
  } catch (e) {
    isConnected.value = false
    error.value = store.deviceRemoved
      ? 'O acesso anterior foi removido. Conecte-se ao servidor para gerar uma nova chave.'
      : 'Erro de conexão ao gerar chave de ativação.'
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
      const active = playlists.find((p: any) => p.is_main && p.is_active) || playlists.find((p: any) => p.is_active)
      if (active) await handleUrlLoad(active)
    }
  } catch (e) {
    console.error('Falha ao consultar listas remotas.')
  }
}

function stopPolling() {
  isWaiting.value = false
  if (pollingInterval) {
    clearTimeout(pollingInterval)
    pollingInterval = null
  }
}

async function handleUrlLoad(config: PlaylistConfig) {
  if (!config.url) {
    error.value = 'Please enter a valid URL'
    return
  }
  
  error.value = ''
  try {
    await store.loadConfiguredPlaylist(config)
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
    await requestActivation(false)
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
  <div class="h-full w-full overflow-y-auto bg-[#0a0a0c] text-white flex items-center justify-center p-3 sm:p-5 lg:p-8">
    <div class="onboarding-card bg-[#14161a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl my-auto p-4 sm:p-5 lg:p-8">
      
      <div class="onboarding-layout grid grid-cols-1 landscape:grid-cols-12 sm:grid-cols-12 gap-4 sm:gap-5 lg:gap-8 items-stretch">
        
        <!-- Coluna Esquerda: Marca, Instruções, Status e Ações -->
        <div class="landscape:col-span-5 sm:col-span-5 flex flex-col justify-between text-center landscape:text-left sm:text-left">
          <div>
            <!-- Brand & Header -->
            <div class="flex flex-col landscape:items-start sm:items-start items-center mb-3 lg:mb-5">
              <img src="/skue-logo.svg" alt="Skue - See More" class="onboarding-logo h-9 sm:h-10 lg:h-12 w-auto mb-1.5 lg:mb-2" />
              <p class="onboarding-intro text-xs lg:text-sm text-gray-400">Configure sua lista para começar a assistir</p>
            </div>

            <!-- Alerta de Erro -->
            <div
              v-if="error"
              class="bg-red-950/60 border border-red-800/70 text-red-200 px-3 py-2 rounded-lg mb-3 lg:mb-4 text-xs leading-snug"
            >
              {{ error }}
              <p v-if="downloadDiagnostic" class="mt-2 text-[11px] leading-relaxed">{{ downloadDiagnostic }}</p>
            </div>

            <!-- Instruções Passo a Passo -->
            <div class="onboarding-instructions space-y-2 lg:space-y-2.5 text-xs lg:text-sm text-gray-300 bg-white/[0.03] p-3 lg:p-4 rounded-xl border border-white/[0.07] leading-relaxed text-left">
              <div class="flex items-start gap-2.5">
                <span class="w-5 h-5 rounded-full bg-primary/20 text-primary font-semibold text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                <p>
                  Acesse <strong class="text-white">{{ portalUrl.replace(/^https?:\/\//, '') }}</strong> ou escaneie o QR Code ao lado.
                </p>
              </div>
              <div class="flex items-start gap-2.5">
                <span class="w-5 h-5 rounded-full bg-primary/20 text-primary font-semibold text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                <p>
                  Informe o <strong class="text-white">MAC</strong> e a <strong class="text-white">Chave de Ativação</strong> para enviar suas listas IPTV.
                </p>
              </div>
            </div>
          </div>

          <!-- Rodapé da Coluna Esquerda: Ações e Status -->
          <div class="mt-3 lg:mt-5 pt-3 lg:pt-4 border-t border-white/[0.07] space-y-2.5">
            <div class="flex flex-wrap items-center gap-2">
              <button
                @click="requestActivation()"
                class="onboarding-action flex-1 bg-white/[0.06] hover:bg-white/[0.12] focus:bg-white focus:text-black text-gray-200 font-medium py-2 lg:py-2.5 px-3.5 rounded-xl border border-white/10 transition-all flex justify-center items-center gap-2 text-xs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                Recarregar Conexão
              </button>

              <button
                v-if="store.isLoaded"
                @click="router.push('/')"
                class="onboarding-action bg-white/[0.03] hover:bg-white/[0.08] focus:bg-white focus:text-black text-gray-300 font-medium py-2 lg:py-2.5 px-3.5 rounded-xl border border-white/10 transition-all flex justify-center items-center gap-1.5 text-xs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                Início
              </button>
            </div>

            <div>
              <p v-if="isWaiting" class="onboarding-status text-[11px] text-gray-400 flex items-center justify-center landscape:justify-start sm:justify-start gap-2">
                <span class="relative flex h-2 w-2 shrink-0">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                {{ store.registrationPending ? 'Aguardando confirmação no portal...' : 'Aguardando configuração remota...' }}
              </p>
              <p v-else-if="isConnected" class="onboarding-status text-[11px] text-amber-400/90 flex items-center justify-center landscape:justify-start sm:justify-start gap-2">
                <span class="inline-flex rounded-full h-2 w-2 bg-amber-400 shrink-0"></span>
                {{ error ? 'Conectado ao serviço de ativação. Falha ao carregar a lista.' : 'Conectado ao serviço de ativação.' }}
              </p>
              <p v-else class="onboarding-status text-[11px] text-red-400/90 flex items-center justify-center landscape:justify-start sm:justify-start gap-2">
                <span class="inline-flex rounded-full h-2 w-2 bg-red-500/80 shrink-0"></span>
                Desconectado do serviço de ativação.
              </p>
            </div>
          </div>
        </div>

        <!-- Coluna Direita: QR Code + Credenciais do Dispositivo -->
        <div class="landscape:col-span-7 sm:col-span-7 flex">
          <div class="w-full bg-background rounded-xl p-3.5 sm:p-4 lg:p-6 border border-white/[0.08] shadow-inner flex flex-col landscape:flex-row sm:flex-row items-center justify-center gap-4 sm:gap-5 lg:gap-6">
            
            <!-- QR Code -->
            <div class="flex flex-col items-center shrink-0">
              <div class="bg-white p-2.5 lg:p-3 rounded-xl shadow-lg inline-flex items-center justify-center">
                <qrcode-vue
                  :value="portalUrl"
                  :size="140"
                  level="M"
                  render-as="svg"
                  class="onboarding-qr w-28 h-28 sm:w-32 sm:h-32 lg:w-36 lg:h-36"
                />
              </div>
              <span class="onboarding-caption text-[10px] text-gray-500 uppercase tracking-wider font-medium mt-2">
                Escaneie no celular
              </span>
            </div>

            <!-- Divisor Vertical (Paisagem) / Horizontal (Retrato) -->
            <div class="hidden landscape:block sm:block w-px self-stretch bg-gray-800/80 my-1"></div>
            <div class="block landscape:hidden sm:hidden h-px w-full bg-gray-800/80"></div>

            <!-- Dados do Dispositivo (MAC + Key) -->
            <div class="flex-1 min-w-0 w-full flex flex-col justify-center space-y-3 lg:space-y-4 text-center landscape:text-left sm:text-left">
              <!-- MAC Address -->
              <div>
                <span class="onboarding-label text-[10px] lg:text-[11px] text-gray-500 uppercase tracking-widest font-semibold block mb-1">
                  Endereço MAC da TV
                </span>
                <div class="onboarding-mac text-base sm:text-lg lg:text-xl font-mono font-bold text-primary tracking-wider break-all">
                  {{ deviceMac || 'Carregando...' }}
                </div>
              </div>

              <div class="border-t border-gray-800/80"></div>

              <!-- Activation Key -->
              <div>
                <span class="onboarding-label text-[10px] lg:text-[11px] text-gray-500 uppercase tracking-widest font-semibold block mb-1">
                  Chave de Ativação (Key)
                </span>
                <div
                  v-if="activationKey"
                  class="onboarding-key text-2xl sm:text-2xl lg:text-3xl font-mono font-extrabold text-white tracking-[0.15em]"
                >
                  {{ activationKey }}
                </div>
                <div v-else-if="!store.deviceRemoved" class="flex justify-center landscape:justify-start sm:justify-start items-center py-1.5">
                  <div class="animate-spin rounded-full h-5 w-5 lg:h-6 lg:w-6 border-2 border-white/15 border-t-primary"></div>
                </div>
                <p v-else class="text-sm text-gray-400">Aguardando nova chave</p>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  </div>
</template>

<style scoped>
/* Keep short landscape screens compact; enlarge the card on desktops and TVs. */
@media (min-width: 1200px) and (min-height: 550px) {
  .onboarding-card {
    max-width: 1280px;
    padding: 40px;
  }

  .onboarding-layout {
    min-height: 400px;
    gap: 40px;
  }

  .onboarding-logo { height: 72px; }
  .onboarding-intro { font-size: 18px; line-height: 1.5; }
  .onboarding-instructions { padding: 20px; font-size: 16px; line-height: 1.6; }
  .onboarding-action { padding-top: 14px; padding-bottom: 14px; font-size: 16px; }
  .onboarding-status { font-size: 14px; line-height: 1.5; }
  .onboarding-qr { width: clamp(176px, 13vw, 208px); height: auto; }
  .onboarding-caption, .onboarding-label { font-size: 12px; line-height: 1.5; }

  .onboarding-mac {
    font-size: clamp(20px, 1.45vw, 26px);
    letter-spacing: 0.025em;
    white-space: nowrap;
  }

  .onboarding-key { font-size: 40px; line-height: 1.3; }
}
</style>
