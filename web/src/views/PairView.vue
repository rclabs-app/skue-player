<script setup lang="ts">
import { ref } from 'vue'
import { getApiUrl } from '../utils/api'

const code = ref('')
const playlistUrl = ref('')
const isSubmitting = ref(false)
const success = ref(false)
const error = ref('')

async function submitPairing() {
  const cleanCode = code.value.trim().toUpperCase()
  if (cleanCode.length !== 6 || !playlistUrl.value) {
    error.value = 'Preencha o código de 6 dígitos e a URL da playlist.'
    return
  }

  error.value = ''
  isSubmitting.value = true

  try {
    const response = await fetch(getApiUrl(`/api/v1/pairing-codes/${cleanCode}/payload`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: JSON.stringify({ url: playlistUrl.value })
      })
    })

    if (!response.ok) {
      if (response.status === 404) throw new Error('Código inválido ou expirado.')
      throw new Error('Falha ao parear dispositivo.')
    }

    success.value = true
  } catch (e: any) {
    error.value = e.message || 'Ocorreu um erro.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-[100dvh] bg-background p-4">
    <div class="w-full max-w-md bg-surface border border-gray-800 rounded-2xl shadow-2xl p-6 md:p-8">
      
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-primary mb-2">Skue Pareamento</h1>
        <p class="text-gray-400 text-sm">Insira o código exibido na sua TV</p>
      </div>

      <div v-if="success" class="text-center py-6">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 text-green-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <h2 class="text-xl font-bold text-white mb-2">Pareamento Concluído!</h2>
        <p class="text-gray-400">Pode olhar para sua TV. O aplicativo será iniciado automaticamente.</p>
      </div>

      <div v-else class="space-y-5">
        <div v-if="error" class="p-3 bg-red-900/50 border border-red-700 text-red-200 rounded-lg text-sm text-center">
          {{ error }}
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-400 mb-1.5">Código da TV</label>
          <input 
            v-model="code" 
            type="text" 
            maxlength="6"
            placeholder="000000"
            class="w-full bg-background border border-gray-700 rounded-lg p-4 text-center text-2xl tracking-[0.5em] uppercase font-mono text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
          >
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-400 mb-1.5">Sua URL M3U</label>
          <input 
            v-model="playlistUrl" 
            type="url" 
            placeholder="https://exemplo.com/lista.m3u"
            class="w-full bg-background border border-gray-700 rounded-lg p-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
          >
        </div>
        
        <button 
          @click="submitPairing" 
          :disabled="isSubmitting"
          class="w-full bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-lg transition-colors mt-2"
        >
          {{ isSubmitting ? 'Enviando...' : 'Conectar à TV' }}
        </button>
      </div>

    </div>
  </div>
</template>
