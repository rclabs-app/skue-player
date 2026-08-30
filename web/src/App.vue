<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { usePlaylistStore } from './stores/playlist'
import { useTvRemote } from './composables/useTvRemote'

const store = usePlaylistStore()
const route = useRoute()
const router = useRouter()
const { onRemoteKey } = useTvRemote()

// ── Cursor hide on remote use ─────────────────────────────────────────────
const isRemoteActive = ref(false)
let mouseMoveTimer: ReturnType<typeof setTimeout> | null = null

function onMouseMove() {
  if (isRemoteActive.value) {
    isRemoteActive.value = false
    document.body.classList.remove('tv-remote-active')
  }
  if (mouseMoveTimer) clearTimeout(mouseMoveTimer)
}

function activateRemoteMode() {
  if (!isRemoteActive.value) {
    isRemoteActive.value = true
    document.body.classList.add('tv-remote-active')
  }
}

// ── Global remote handlers ────────────────────────────────────────────────
onRemoteKey('HOME', () => { router.push('/') })

onRemoteKey('BACK', () => {
  // Only handle BACK if no modal/player is open (they handle it themselves)
  const hasModal = document.querySelector('[data-tv-modal]')
  if (hasModal) return false // let the modal handle it
  if (window.history.length > 1) router.back()
})

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove)

  // Treat any arrow/remote key press as entering remote mode
  window.addEventListener('keydown', activateRemoteMode, { capture: true, passive: true })
  
  // FALLBACK: Always hide splash screen after a few seconds in case views fail to load
  setTimeout(() => {
    if (typeof (window as any).hideCustomSplash === 'function') {
      (window as any).hideCustomSplash()
    }
  }, 3500)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('keydown', activateRemoteMode, { capture: true })
  if (mouseMoveTimer) clearTimeout(mouseMoveTimer)
})
</script>

<template>
  <div class="h-full w-full flex bg-[#0f171e] text-gray-200 overflow-hidden font-sans">
    
    <!-- Sidebar Navigation -->
    <aside
      v-if="store.isLoaded || route.path === '/settings'"
      class="w-16 md:w-20 shrink-0 flex flex-col items-center py-6 z-50"
      data-tv-zone="sidebar"
    >
      
      <!-- Top Logo -->
      <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 mb-10 shadow-lg shadow-blue-500/30">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </div>
      
      <nav class="flex flex-col gap-6 w-full items-center">
        <!-- Home -->
        <router-link
          to="/"
          class="tv-nav-icon relative flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-gray-300 transition-all duration-300"
          active-class="!text-white"
          title="Início"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </router-link>

        <!-- Search -->
        <router-link
          to="/search"
          class="tv-nav-icon relative flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-gray-300 transition-all duration-300"
          active-class="!text-white"
          title="Buscar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </router-link>

        <!-- Movies -->
        <router-link
          to="/movies"
          class="tv-nav-icon relative flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-gray-300 transition-all duration-300"
          active-class="!text-white"
          title="Filmes"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>
        </router-link>

        <!-- Series -->
        <router-link
          to="/series"
          class="tv-nav-icon relative flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-gray-300 transition-all duration-300"
          active-class="!text-white"
          title="Séries"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h16"/><path d="M4 14h16"/><rect width="16" height="16" x="4" y="4" rx="2"/></svg>
        </router-link>

        <!-- Live TV -->
        <router-link
          to="/live"
          class="tv-nav-icon relative flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-gray-300 transition-all duration-300"
          active-class="!text-white"
          title="TV Ao Vivo"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
          <span class="absolute top-1 right-1 flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
          </span>
        </router-link>

        <!-- Guide (EPG) -->
        <router-link
          to="/guide"
          class="tv-nav-icon relative flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-gray-300 transition-all duration-300"
          active-class="!text-white"
          title="Guia de Programação (EPG)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
        </router-link>
      </nav>

      <div class="mt-auto mb-4">
        <router-link
          to="/settings"
          class="tv-nav-icon relative flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-gray-300 transition-all duration-300"
          active-class="!text-white"
          title="Configurações"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        </router-link>
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 relative overflow-hidden">
      <RouterView />
    </main>
    
    <!-- Global Loading Overlay -->
    <div v-if="store.isProcessing" class="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-[60]">
      <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary mb-6 shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
      <div class="text-2xl font-bold tracking-wide text-white">{{ store.processingProgress }}</div>
    </div>
  </div>
</template>

