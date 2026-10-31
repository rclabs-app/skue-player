<script setup lang="ts">
import { ref, computed } from 'vue'
import QrcodeVue from 'qrcode.vue'
import { usePlaylistStore } from '../stores/playlist'
import { useTvRemote } from '../composables/useTvRemote'
import { getApiUrl } from '../utils/api'

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const store = usePlaylistStore()
const { onRemoteKey } = useTvRemote()

const license = computed(() => store.deviceLicense)
const mac = computed(() => store.deviceMac)
const isBlocked = computed(() => license.value.status === 'blocked')

const isProcessingCheckout = ref(false)
const checkoutError = ref('')

// URL do portal de ativação para escanear no celular
const portalCheckoutUrl = computed(() => {
  const base = window.location.origin
  return `${base}/portal?mac=${encodeURIComponent(mac.value)}&action=activate`
})

async function handleStartCheckout(plan: 'yearly' | 'lifetime') {
  if (isProcessingCheckout.value) return
  isProcessingCheckout.value = true
  checkoutError.value = ''

  try {
    const response = await fetch(getApiUrl('/api/v1/payments/checkout-session'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mac: mac.value,
        plan: plan,
      })
    })

    const data = await response.json()
    if (!response.ok || !data.checkout_url) {
      throw new Error(data.error || 'Falha ao iniciar pagamento com cartão.')
    }

    // Redireciona para o checkout seguro da Stripe
    window.location.href = data.checkout_url
  } catch (err: any) {
    console.error('Checkout error:', err)
    checkoutError.value = err.message || 'Erro ao conectar ao checkout.'
  } finally {
    isProcessingCheckout.value = false
  }
}

async function handleRefresh() {
  await store.syncHandshake()
  emit('refresh')
}

// Bloqueia teclas no modal de bloqueio exceto refresh/OK
onRemoteKey('OK', () => {
  handleRefresh()
  return true
})
</script>

<template>
  <div 
    v-if="!license.is_licensed" 
    class="fixed inset-0 z-[9999] bg-[#090d12]/95 backdrop-blur-xl flex items-center justify-center p-6 text-white"
    data-tv-modal
  >
    <div class="max-w-xl w-full bg-[#131c26] border border-red-500/30 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
      <!-- Glow effect -->
      <div class="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <!-- Icon -->
      <div class="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-red-400">
        <svg v-if="isBlocked" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>

      <!-- Title & Message -->
      <h2 class="text-2xl font-bold mb-1">
        {{ isBlocked ? 'Aparelho Suspenso' : 'Período de Testes Expirado' }}
      </h2>
      <p class="text-gray-400 text-xs max-w-md leading-relaxed mb-5">
        {{ isBlocked 
          ? 'Este dispositivo foi suspenso pelo administrador. Entre em contato para mais informações.' 
          : 'Seu período de degustação encerrou. Escolha um plano abaixo para ativar seu aparelho com Cartão de Crédito:' 
        }}
      </p>

      <!-- Plan options (se não estiver bloqueado) -->
      <div v-if="!isBlocked" class="grid grid-cols-2 gap-3 w-full mb-5">
        <!-- Plano Anual -->
        <button
          @click="handleStartCheckout('yearly')"
          :disabled="isProcessingCheckout"
          class="bg-black/40 hover:bg-black/60 border border-sky-500/40 hover:border-sky-400 rounded-xl p-4 text-left transition-all group flex flex-col justify-between"
        >
          <div>
            <span class="text-[10px] uppercase font-bold text-sky-400 tracking-wider block mb-1">Mais Popular</span>
            <div class="text-sm font-bold text-white group-hover:text-sky-300">Licença 1 Ano</div>
            <div class="text-xl font-extrabold text-white mt-1">R$ 19,90</div>
          </div>
          <div class="mt-3 text-[11px] text-gray-400 flex items-center gap-1">
            <span>Pagar c/ Cartão</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
          </div>
        </button>

        <!-- Plano Vitalício -->
        <button
          @click="handleStartCheckout('lifetime')"
          :disabled="isProcessingCheckout"
          class="bg-black/40 hover:bg-black/60 border border-amber-500/40 hover:border-amber-400 rounded-xl p-4 text-left transition-all group flex flex-col justify-between"
        >
          <div>
            <span class="text-[10px] uppercase font-bold text-amber-400 tracking-wider block mb-1">Acesso Perpétuo</span>
            <div class="text-sm font-bold text-white group-hover:text-amber-300">Licença Vitalícia</div>
            <div class="text-xl font-extrabold text-white mt-1">R$ 49,90</div>
          </div>
          <div class="mt-3 text-[11px] text-gray-400 flex items-center gap-1">
            <span>Pagar c/ Cartão</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
          </div>
        </button>
      </div>

      <div v-if="checkoutError" class="text-red-400 text-xs mb-4">
        {{ checkoutError }}
      </div>

      <!-- QR Code para escanear com a câmera da TV -->
      <div class="bg-black/30 border border-gray-800 rounded-xl p-3 mb-5 flex items-center gap-4 w-full text-left">
        <div class="bg-white p-2 rounded-lg shrink-0">
          <qrcode-vue :value="portalCheckoutUrl" :size="75" level="M" render-as="svg" />
        </div>
        <div class="flex-1 min-w-0">
          <span class="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">Ativar pelo Celular</span>
          <p class="text-xs text-gray-300 leading-tight mb-1">
            Aponte a câmera do celular para abrir o checkout seguro.
          </p>
          <span class="font-mono text-xs font-bold text-sky-400 select-all block truncate">MAC: {{ mac }}</span>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="flex gap-3 w-full">
        <button
          @click="handleRefresh"
          class="flex-1 py-3 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-xs transition-all flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          Já paguei / Verificar Licença
        </button>
      </div>
    </div>
  </div>
</template>
