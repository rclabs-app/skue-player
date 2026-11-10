<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Capacitor } from '@capacitor/core'
import { usePlaylistStore } from '../stores/playlist'

defineProps<{
  modelValue?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'accepted'): void
}>()

const store = usePlaylistStore()
const isAccepting = ref(false)
const acceptBtnRef = ref<HTMLButtonElement | null>(null)

const TERMS_VERSION = '1.0-draft'
const STORAGE_KEY = 'skue_terms_accepted_version'

const isOpen = ref(false)

onMounted(() => {
  const accepted = localStorage.getItem(STORAGE_KEY)
  if (!accepted) {
    isOpen.value = true
    setTimeout(() => {
      acceptBtnRef.value?.focus()
    }, 150)
  }
})

function openModal() {
  isOpen.value = true
  setTimeout(() => {
    acceptBtnRef.value?.focus()
  }, 100)
}

defineExpose({
  openModal
})

async function acceptTerms() {
  isAccepting.value = true
  try {
    if (!store.deviceMac) {
      await store.initialize()
    }

    const platform = Capacitor.isNativePlatform() ? 'android' : 'web'
    const deviceId = store.deviceMac || 'anonymous-device'

    const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || ''
    await fetch(`${apiBase}/api/v1/terms/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        device_id: deviceId,
        terms_version: TERMS_VERSION,
        platform,
      })
    }).catch(() => {
      // Fallback tolerante caso o backend esteja em rota offline inicial
    })

    localStorage.setItem(STORAGE_KEY, TERMS_VERSION)
    isOpen.value = false
    emit('update:modelValue', false)
    emit('accepted')
  } finally {
    isAccepting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen || modelValue"
      class="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none"
      data-tv-modal
    >
      <div
        class="bg-[#14161a] border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full p-6 md:p-8 flex flex-col max-h-[90vh] overflow-hidden text-gray-200"
      >
        <!-- Header -->
        <div class="flex items-center gap-4 mb-4 pb-4 border-b border-white/10 shrink-0">
          <img src="/skue-logo.svg" alt="Skue" class="h-9 w-auto" />
          <div>
            <h2 class="text-lg font-semibold text-white tracking-tight">Termos de Uso & Declaração de Neutralidade</h2>
            <p class="text-xs text-gray-400">Leia com atenção antes de utilizar o aplicativo</p>
          </div>
        </div>

        <!-- Scrollable Legal Text -->
        <div class="flex-1 overflow-y-auto space-y-3.5 pr-2 text-xs md:text-sm text-gray-300 leading-relaxed custom-scrollbar">
          <div class="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-gray-300 text-xs">
            <strong class="text-white">Arquitetura Local-First & Bring Your Own Content:</strong>
            O Skue é um reprodutor de mídia neutro e agnóstico, desenvolvido exclusivamente para organização e execução técnica de fluxos de vídeo fornecidos diretamente pelo próprio usuário.
          </div>

          <div>
            <h3 class="font-semibold text-white text-xs md:text-sm mb-1">1. Neutralidade Absoluta de Conteúdo</h3>
            <p class="text-gray-400 text-xs">
              O aplicativo <strong>não hospeda, não fornece, não distribui, não indexa e não recomenda</strong> nenhum arquivo de mídia, canal de televisão, filme ou série. O Skue funciona como uma ferramenta técnica neutra, similar a navegadores web e players como VLC e Kodi.
            </p>
          </div>

          <div>
            <h3 class="font-semibold text-white text-xs md:text-sm mb-1">2. Responsabilidade Exclusiva do Usuário</h3>
            <p class="text-gray-400 text-xs">
              Todas as listas (M3U, Xtream Codes) e URLs inseridas são de exclusiva responsabilidade do usuário. Ao utilizar o Skue, você declara e garante que possui autorização legal para reproduzir as transmissões e conteúdos das fontes adicionadas. Os desenvolvedores e mantenedores não se responsabilizam pelo uso indevido do software.
            </p>
          </div>

          <div>
            <h3 class="font-semibold text-white text-xs md:text-sm mb-1">3. Privacidade e Processamento Local</h3>
            <p class="text-gray-400 text-xs">
              Em respeito à sua privacidade (LGPD/GDPR), todo o processamento de listas, histórico de visualização e favoritos é armazenado localmente no hardware do seu dispositivo (IndexedDB / SQLite local).
            </p>
          </div>
        </div>

        <!-- Actions -->
        <div class="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-end gap-3 shrink-0">
          <button
            ref="acceptBtnRef"
            type="button"
            :disabled="isAccepting"
            @click="acceptTerms"
            @keydown.enter.prevent="acceptTerms"
            class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white hover:bg-gray-200 focus:bg-primary focus:text-white text-black font-semibold text-xs transition-all outline-none flex items-center justify-center gap-2"
          >
            <span v-if="isAccepting" class="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
            <span>Concordar e Continuar</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 9999px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 9999px;
}
</style>
