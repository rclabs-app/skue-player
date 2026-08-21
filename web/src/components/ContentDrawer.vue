<script setup lang="ts">
import { ref, defineAsyncComponent, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  section: 'movies' | 'series' | 'live' | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const MoviesView = defineAsyncComponent(() => import('../views/MoviesView.vue'))
const SeriesView = defineAsyncComponent(() => import('../views/SeriesView.vue'))
const LiveView = defineAsyncComponent(() => import('../views/LiveView.vue'))

const visible = ref(false)

// Animate in when section changes
watch(() => props.section, (val) => {
  if (val) {
    // Small delay so CSS transition triggers
    requestAnimationFrame(() => { visible.value = true })
  } else {
    visible.value = false
  }
}, { immediate: true })

function close() {
  visible.value = false
  // Wait for animation to finish before hiding
  setTimeout(() => emit('close'), 320)
}

function handleKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(() => window.addEventListener('keydown', handleKey))
onUnmounted(() => window.removeEventListener('keydown', handleKey))

const sectionLabel = {
  movies: 'Filmes',
  series: 'Séries',
  live: 'TV Ao Vivo',
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="fade">
      <div 
        v-if="section"
        class="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
        @click="close"
      />
    </Transition>

    <!-- Drawer Panel -->
    <Transition name="slide">
      <div
        v-if="section"
        :class="['fixed inset-y-0 right-0 z-50 flex flex-col bg-[#0f171e] shadow-2xl', visible ? 'w-[calc(100vw-80px)]' : 'w-[calc(100vw-80px)]']"
        style="left: 80px;"
      >
        <!-- Header bar -->
        <header class="flex items-center gap-4 px-8 py-4 border-b border-gray-800/60 shrink-0 bg-black/40 backdrop-blur-xl">
          <button
            @click="close"
            class="flex items-center justify-center w-9 h-9 rounded-full bg-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
            title="Fechar (Esc)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
          <div class="flex items-center gap-3">
            <!-- Movies icon -->
            <template v-if="section === 'movies'">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>
            </template>
            <!-- Series icon -->
            <template v-if="section === 'series'">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><path d="M4 10h16"/><path d="M4 14h16"/><rect width="16" height="16" x="4" y="4" rx="2"/></svg>
            </template>
            <!-- Live icon -->
            <template v-if="section === 'live'">
              <span class="relative flex h-2.5 w-2.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
            </template>
            <h2 class="text-xl font-bold text-white tracking-wide">{{ section ? sectionLabel[section] : '' }}</h2>
          </div>
        </header>

        <!-- Scrollable content area -->
        <div class="flex-1 overflow-y-auto overflow-x-hidden">
          <Suspense>
            <template #default>
              <MoviesView v-if="section === 'movies'" />
              <SeriesView v-else-if="section === 'series'" />
              <LiveView   v-else-if="section === 'live'" />
            </template>
            <template #fallback>
              <div class="flex items-center justify-center h-full">
                <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary"></div>
              </div>
            </template>
          </Suspense>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Backdrop fade */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Panel slide from right */
.slide-enter-active { transition: transform 0.32s cubic-bezier(0.32, 0, 0.15, 1); }
.slide-leave-active { transition: transform 0.28s cubic-bezier(0.32, 0, 0.15, 1); }
.slide-enter-from  { transform: translateX(100%); }
.slide-leave-to   { transform: translateX(100%); }
</style>
