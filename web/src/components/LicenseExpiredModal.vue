<script setup lang="ts">
import { ref, computed } from 'vue'
import QrcodeVue from 'qrcode.vue'
import { usePlaylistStore } from '../stores/playlist'
import { useTvRemote } from '../composables/useTvRemote'
import { getApiUrl } from '../utils/api'
import { getPortalUrl } from '../utils/portal'

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
  const url = new URL(getPortalUrl())
  url.searchParams.set('mac', mac.value)
  url.searchParams.set('action', 'activate')
  return url.toString()
})

async function handleStartCheckout(plan: 'yearly') {
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
    class="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 text-white"
    data-tv-modal
  >
    <div class="max-w-lg w-full bg-[#14161a] border border-white/10 rounded-2xl p-7 md:p-8 shadow-2xl flex flex-col">
      <!-- Header -->
      <div class="flex items-start gap-4 mb-6">
        <div class="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0 text-gray-300">
          <svg v-if="isBlocked" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="text-amber-400">
            <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>

        <div class="text-left">
          <h2 class="text-xl font-semibold text-white tracking-tight">
            {{ isBlocked ? 'Aparelho Suspenso' : 'Período de Testes Encerrado' }}
          </h2>
          <p class="text-gray-400 text-xs leading-relaxed mt-1">
            {{ isBlocked 
              ? 'Este dispositivo foi suspenso pelo administrador. Entre em contato com o suporte para mais informações.' 
              : 'Seu período de avaliação gratuita de 7 dias terminou. Ative a licença anual para continuar utilizando o aplicativo neste aparelho.' 
            }}
          </p>
        </div>
      </div>

      <!-- Plan option (se não estiver bloqueado) -->
      <div v-if="!isBlocked" class="w-full mb-4">
        <button
          @click="handleStartCheckout('yearly')"
          :disabled="isProcessingCheckout"
          class="w-full bg-white/[0.03] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/15 hover:border-white/25 focus:border-white/40 rounded-xl p-4 transition-all group flex items-center justify-between text-left"
        >
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-semibold text-white">Licença Anual</span>
              <span class="text-[10px] font-medium text-gray-300 bg-white/[0.08] px-2 py-0.5 rounded">12 meses</span>
            </div>
            <div class="text-xs text-gray-400">Acesso completo liberado imediatamente para este dispositivo</div>
          </div>
          <div class="text-right shrink-0 pl-4">
            <div class="text-xl font-bold text-white tracking-tight">R$ 19,90</div>
            <div class="mt-0.5 text-[11px] text-gray-300 group-hover:text-white font-medium flex items-center justify-end gap-1">
              <span>{{ isProcessingCheckout ? 'Aguarde...' : 'Continuar' }}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
            </div>
          </div>
        </button>
      </div>

      <div v-if="checkoutError" class="text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs mb-4">
        {{ checkoutError }}
      </div>

      <!-- QR Code para escanear com a câmera na TV -->
      <div class="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3.5 mb-5 flex items-center gap-4 w-full text-left">
        <div class="bg-white p-2 rounded-lg shrink-0">
          <qrcode-vue :value="portalCheckoutUrl" :size="72" level="M" render-as="svg" />
        </div>
        <div class="flex-1 min-w-0">
          <span class="text-[11px] font-semibold text-gray-200 block mb-0.5">Ativar pelo celular</span>
          <p class="text-xs text-gray-400 leading-relaxed mb-2">
            Escaneie o QR Code com a câmera do smartphone para concluir o pagamento.
          </p>
          <div class="inline-flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.08] px-2.5 py-1 rounded text-[11px] font-mono text-gray-300">
            <span class="text-gray-500">MAC</span>
            <span class="text-white font-semibold select-all">{{ mac }}</span>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="flex gap-3 w-full">
        <button
          @click="handleRefresh"
          class="w-full py-2.5 px-4 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] focus:bg-white text-gray-200 focus:text-black border border-white/10 font-medium text-xs transition-all flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          Já paguei · Verificar licença
        </button>
      </div>
    </div>
  </div>
</template>
