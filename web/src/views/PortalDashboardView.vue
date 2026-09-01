<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getApiUrl } from '../utils/api'

const router = useRouter()
const token = ref('')
const device = ref<{ mac: string; name: string } | null>(null)
const playlists = ref<any[]>([])
const isLoading = ref(true)
const error = ref('')

// Form state
const showModal = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const editingPlaylistId = ref<number | null>(null)

const name = ref('')
const type = ref<'m3u' | 'xtream'>('m3u')
const url = ref('')
const username = ref('')
const password = ref('')
const isActive = ref(true)

async function fetchPlaylists() {
  try {
    isLoading.value = true
    const response = await fetch(getApiUrl('/api/v1/portal/playlists'), {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token.value}`
      }
    })

    if (response.status === 401) {
      handleLogout()
      return
    }

    if (!response.ok) throw new Error('Falha ao carregar playlists.')
    playlists.value = await response.json()
  } catch (e: any) {
    error.value = e.message || 'Erro de conexão.'
  } finally {
    isLoading.value = false
  }
}

function openCreateModal() {
  modalMode.value = 'create'
  editingPlaylistId.value = null
  name.value = ''
  type.value = 'm3u'
  url.value = ''
  username.value = ''
  password.value = ''
  isActive.value = true
  showModal.value = true
}

function openEditModal(playlist: any) {
  modalMode.value = 'edit'
  editingPlaylistId.value = playlist.id
  name.value = playlist.name
  type.value = playlist.type
  url.value = playlist.url
  username.value = playlist.username || ''
  password.value = playlist.password || ''
  isActive.value = playlist.is_active
  showModal.value = true
}

async function handleSave() {
  if (!name.value || !url.value) {
    alert('Por favor, preencha os campos obrigatórios.')
    return
  }

  const payload: any = {
    name: name.value,
    type: type.value,
    url: url.value,
    is_active: isActive.value
  }

  if (type.value === 'xtream') {
    payload.username = username.value
    payload.password = password.value
  }

  try {
    let response;
    if (modalMode.value === 'create') {
      response = await fetch(getApiUrl('/api/v1/portal/playlists'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token.value}`
        },
        body: JSON.stringify(payload)
      })
    } else {
      response = await fetch(getApiUrl(`/api/v1/portal/playlists/${editingPlaylistId.value}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token.value}`
        },
        body: JSON.stringify(payload)
      })
    }

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Erro ao salvar playlist.')
    }

    showModal.value = false
    await fetchPlaylists()
  } catch (e: any) {
    alert(e.message)
  }
}

async function handleDelete(id: number) {
  if (!confirm('Deseja realmente excluir esta lista?')) return

  try {
    const response = await fetch(getApiUrl(`/api/v1/portal/playlists/${id}`), {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token.value}`
      }
    })

    if (!response.ok) throw new Error('Falha ao excluir.')
    await fetchPlaylists()
  } catch (e: any) {
    alert(e.message)
  }
}

async function handleSetMain(id: number) {
  try {
    const response = await fetch(getApiUrl(`/api/v1/portal/playlists/${id}/set-main`), {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token.value}`
      }
    })

    if (!response.ok) throw new Error('Falha ao definir como principal.')
    await fetchPlaylists()
  } catch (e: any) {
    alert(e.message)
  }
}

function handleLogout() {
  localStorage.removeItem('rc_portal_token')
  localStorage.removeItem('rc_portal_device')
  router.push('/portal')
}

onMounted(() => {
  const storedToken = localStorage.getItem('rc_portal_token')
  const storedDevice = localStorage.getItem('rc_portal_device')

  if (!storedToken || !storedDevice) {
    handleLogout()
    return
  }

  token.value = storedToken
  device.value = JSON.parse(storedDevice)
  fetchPlaylists()
})
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <!-- Header Section -->
    <div class="flex flex-col md:flex-row md:items-center justify-between bg-surface border border-gray-800 p-6 rounded-2xl mb-8 gap-4">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h1 class="text-xl font-bold text-white">{{ device?.name || 'Dispositivo' }}</h1>
          <p class="text-sm font-mono text-gray-400 mt-0.5">MAC: {{ device?.mac }}</p>
        </div>
      </div>
      
      <div class="flex items-center gap-3">
        <button 
          @click="openCreateModal"
          class="bg-primary hover:bg-blue-600 text-white font-semibold py-2.5 px-5 rounded-xl transition-all shadow-md shadow-primary/10 text-sm flex items-center gap-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Adicionar Lista
        </button>
        <button 
          @click="handleLogout"
          class="bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-2.5 px-4 rounded-xl transition-all text-sm"
        >
          Sair
        </button>
      </div>
    </div>

    <!-- Playlists list -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-20 gap-3">
      <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      <span class="text-sm text-gray-400">Carregando listas...</span>
    </div>

    <div v-else>
      <div v-if="playlists.length === 0" class="bg-surface border border-dashed border-gray-800 rounded-2xl p-16 text-center">
        <div class="inline-flex p-4 rounded-full bg-gray-900 text-gray-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 class="text-lg font-bold text-white mb-1">Nenhuma lista cadastrada</h3>
        <p class="text-gray-500 text-sm max-w-sm mx-auto mb-6">Cadastre uma lista de reprodução no formato M3U ou Xtream Codes para sincronizar com sua Smart TV.</p>
        <button 
          @click="openCreateModal"
          class="bg-gray-800 hover:bg-gray-750 text-white font-semibold py-2.5 px-5 rounded-xl transition-all text-sm"
        >
          Cadastrar Primeira Lista
        </button>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          v-for="item in playlists" 
          :key="item.id"
          class="bg-surface border rounded-2xl p-6 flex flex-col justify-between transition-all group relative overflow-hidden"
          :class="item.is_main ? 'border-yellow-500/30 hover:border-yellow-500/50' : 'border-gray-800 hover:border-gray-700'"
        >
          <!-- Active status glow -->
          <div v-if="item.is_active" class="absolute left-0 top-0 bottom-0 w-1.5 bg-primary"></div>
          
          <div>
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-lg text-white group-hover:text-primary transition-colors flex items-center gap-2">
                {{ item.name }}
                <span v-if="item.is_main" class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Principal
                </span>
              </h3>
              <span 
                class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                :class="item.type === 'xtream' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'"
              >
                {{ item.type }}
              </span>
            </div>
            
            <div class="space-y-2 mb-6">
              <div class="flex flex-col">
                <span class="text-[10px] text-gray-500 uppercase tracking-wider">URL do Servidor / M3U</span>
                <span class="text-sm text-gray-300 truncate font-mono mt-0.5">{{ item.url }}</span>
              </div>
              <div v-if="item.type === 'xtream'" class="flex gap-4 border-t border-gray-800/50 pt-2 mt-2">
                <div class="flex flex-col">
                  <span class="text-[10px] text-gray-500 uppercase tracking-wider">Usuário</span>
                  <span class="text-sm text-gray-300 font-mono mt-0.5">{{ item.username }}</span>
                </div>
                <div class="flex flex-col">
                  <span class="text-[10px] text-gray-500 uppercase tracking-wider">Senha</span>
                  <span class="text-sm text-gray-300 font-mono mt-0.5">••••••••</span>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between border-t border-gray-850 pt-4">
            <span class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full" :class="item.is_active ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-600'"></span>
              <span class="text-xs text-gray-400">{{ item.is_active ? 'Ativa' : 'Inativa' }}</span>
            </span>

            <div class="flex items-center gap-2">
              <button 
                v-if="!item.is_main"
                @click="handleSetMain(item.id)"
                class="px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white bg-gray-850 hover:bg-gray-800 rounded-lg transition-all border border-gray-700 hover:border-gray-600"
                title="Definir como Principal"
              >
                Definir como Principal
              </button>
              <button 
                @click="openEditModal(item)"
                class="p-2 text-gray-400 hover:text-white bg-gray-850 hover:bg-gray-800 rounded-lg transition-all"
                title="Editar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button 
                @click="handleDelete(item.id)"
                class="p-2 text-gray-400 hover:text-red-400 bg-gray-850 hover:bg-red-500/10 rounded-lg transition-all"
                title="Excluir"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Form -->
    <div v-if="showModal" class="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div class="bg-surface border border-gray-800 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl relative">
        <div class="px-6 py-4 border-b border-gray-850 flex items-center justify-between">
          <h2 class="text-lg font-bold text-white">{{ modalMode === 'create' ? 'Adicionar Nova Lista' : 'Editar Lista' }}</h2>
          <button @click="showModal = false" class="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form @submit.prevent="handleSave" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nome Amigável</label>
            <input 
              v-model="name"
              type="text"
              placeholder="Ex: Minha Lista Principal"
              class="w-full bg-background border border-gray-700 rounded-xl p-3 text-white focus:border-primary focus:outline-none transition-all text-sm"
              required
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tipo de Conexão</label>
            <div class="grid grid-cols-2 gap-3">
              <button
                type="button"
                @click="type = 'm3u'"
                class="py-2.5 rounded-xl text-sm font-semibold border transition-all"
                :class="type === 'm3u' ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-gray-700 text-gray-400 hover:border-gray-650'"
              >
                M3U / URL Direta
              </button>
              <button
                type="button"
                @click="type = 'xtream'"
                class="py-2.5 rounded-xl text-sm font-semibold border transition-all"
                :class="type === 'xtream' ? 'bg-purple-500/10 border-purple-500 text-purple-400' : 'bg-background border-gray-700 text-gray-400 hover:border-gray-650'"
              >
                Xtream Codes API
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {{ type === 'xtream' ? 'Servidor URL (Host)' : 'M3U URL' }}
            </label>
            <input 
              v-model="url"
              type="url"
              :placeholder="type === 'xtream' ? 'http://host.com:port' : 'https://example.com/playlist.m3u'"
              class="w-full bg-background border border-gray-700 rounded-xl p-3 text-white focus:border-primary focus:outline-none transition-all text-sm font-mono"
              required
            />
          </div>

          <div v-if="type === 'xtream'" class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Usuário</label>
              <input 
                v-model="username"
                type="text"
                class="w-full bg-background border border-gray-700 rounded-xl p-3 text-white focus:border-primary focus:outline-none transition-all text-sm font-mono"
                required
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Senha</label>
              <input 
                v-model="password"
                type="text"
                class="w-full bg-background border border-gray-700 rounded-xl p-3 text-white focus:border-primary focus:outline-none transition-all text-sm font-mono"
                required
              />
            </div>
          </div>

          <div class="flex items-center gap-2 pt-2">
            <input 
              v-model="isActive"
              type="checkbox"
              id="is_active"
              class="w-4 h-4 rounded border-gray-700 bg-background text-primary focus:ring-primary focus:ring-opacity-25"
            />
            <label for="is_active" class="text-sm text-gray-300 select-none">Habilitar esta lista na TV</label>
          </div>

          <div class="border-t border-gray-850 pt-4 mt-6 flex justify-end gap-3">
            <button 
              type="button"
              @click="showModal = false"
              class="bg-gray-850 hover:bg-gray-800 text-gray-300 font-semibold py-2.5 px-5 rounded-xl transition-all text-sm"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              class="bg-primary hover:bg-blue-600 text-white font-semibold py-2.5 px-6 rounded-xl transition-all shadow-md shadow-primary/10 text-sm"
            >
              Salvar Lista
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
