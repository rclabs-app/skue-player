<script setup lang="ts">
import { computed } from 'vue'
import QrcodeVue from 'qrcode.vue'
import { usePlaylistStore } from '../stores/playlist'
import { useTvRemote } from '../composables/useTvRemote'

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const store = usePlaylistStore()
const { onRemoteKey } = useTvRemote()

const license = computed(() => store.deviceLicense)
const mac = computed(() => store.deviceMac)

// URL / WhatsApp de suporte / ativação
const whatsappUrl = computed(() => {
  const msg = encodeURIComponent(`Olá! Gostaria de renovar minha licença do Skue Player. Meu MAC é ${mac.value}`)
  return `https://wa.me/5511999999999?text=${msg}`
})

const isBlocked = computed(() => license.value.status === 'blocked')

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
      <div class="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5 text-red-400">
        <svg v-if="isBlocked" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>

      <!-- Title & Message -->
      <h2 class="text-2xl font-bold mb-2">
        {{ isBlocked ? 'Aparelho Suspenso' : 'Período de Testes Expirado' }}
      </h2>
      <p class="text-gray-400 text-sm max-w-md leading-relaxed mb-6">
        {{ isBlocked 
          ? 'Este dispositivo foi temporariamente bloqueado pelo administrador. Entre em contato para regularizar seu acesso.' 
          : 'Seu período de degustação gratuita encerrou. Para continuar assistindo suas listas com máxima performance, renove sua licença.' 
        }}
      </p>

      <!-- QR Code & MAC details -->
      <div class="bg-black/40 border border-gray-800 rounded-xl p-5 mb-6 flex flex-col sm:flex-row items-center gap-6 w-full justify-center">
        <div class="bg-white p-2.5 rounded-lg shrink-0">
          <qrcode-vue :value="whatsappUrl" :size="110" level="M" render-as="svg" />
        </div>
        <div class="text-left space-y-2">
          <div>
            <span class="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">Seu Endereço MAC</span>
            <span class="font-mono text-sm font-bold text-sky-400 select-all">{{ mac }}</span>
          </div>
          <p class="text-xs text-gray-400 leading-tight">
            Aponte a câmera do celular para o QR Code para falar no suporte e ativar seu aparelho.
          </p>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="flex gap-3 w-full">
        <button
          @click="handleRefresh"
          class="flex-1 py-3 px-4 rounded-xl bg-primary hover:bg-blue-600 focus:ring-4 focus:ring-primary/40 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          Já realizei o pagamento / Verificar Licença
        </button>
      </div>
    </div>
  </div>
</template>
