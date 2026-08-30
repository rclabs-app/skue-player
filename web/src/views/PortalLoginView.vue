<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getApiUrl } from '../utils/api'

const router = useRouter()
const mac = ref('')
const deviceKey = ref('')
const error = ref('')
const isLoading = ref(false)

async function handleLogin() {
  if (!mac.value || !deviceKey.value) {
    error.value = 'Por favor, preencha o endereço MAC e a Chave de Ativação.'
    return
  }

  error.value = ''
  isLoading.value = true

  try {
    const response = await fetch(getApiUrl('/api/v1/portal/authenticate'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        mac: mac.value.trim(),
        device_key: deviceKey.value.trim(),
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Falha na autenticação.')
    }

    // Save session details
    localStorage.setItem('rc_portal_token', data.token)
    localStorage.setItem('rc_portal_device', JSON.stringify(data.device))

    router.push('/portal/dashboard')
  } catch (e: any) {
    error.value = e.message || 'Erro de conexão com o servidor.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-[90vh] px-4">
    <div class="bg-surface border border-gray-800 p-8 rounded-2xl shadow-2xl max-w-md w-full relative overflow-hidden">
      <!-- Glow effect decoration -->
      <div class="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div class="text-center mb-8 relative z-10">
        <!-- Logo Icon -->
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary border border-primary/20 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 class="text-3xl font-extrabold text-white tracking-tight">Portal RC Player</h1>
        <p class="text-gray-400 mt-2 text-sm">Gerencie remotamente as playlists de sua TV</p>
      </div>

      <div v-if="error" class="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-lg mb-6 text-sm flex items-start gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{{ error }}</span>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-5 relative z-10">
        <div>
          <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Endereço MAC da TV</label>
          <input
            v-model="mac"
            type="text"
            placeholder="Ex: RC:A1:B2:C3:D4:E5"
            class="w-full bg-background border border-gray-700 rounded-xl p-3.5 text-white focus:border-primary focus:outline-none transition-all placeholder:text-gray-600 font-mono text-center tracking-wide"
            :disabled="isLoading"
            required
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Chave de Ativação (Key)</label>
          <input
            v-model="deviceKey"
            type="text"
            maxlength="6"
            placeholder="Ex: X7K2P9"
            class="w-full bg-background border border-gray-700 rounded-xl p-3.5 text-white focus:border-primary focus:outline-none transition-all placeholder:text-gray-600 font-mono text-center text-xl font-bold uppercase tracking-widest"
            :disabled="isLoading"
            required
          />
        </div>

        <button
          type="submit"
          class="w-full bg-primary hover:bg-blue-600 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 mt-4"
          :disabled="isLoading"
        >
          <span v-if="isLoading" class="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
          <span v-else>Entrar no Dispositivo</span>
        </button>
      </form>
      
      <div class="mt-8 text-center border-t border-gray-800 pt-6">
        <p class="text-xs text-gray-500">
          Abra o RC Player em sua Smart TV para obter o MAC e a Chave de Ativação na tela de boas-vindas.
        </p>
      </div>
    </div>
  </div>
</template>
