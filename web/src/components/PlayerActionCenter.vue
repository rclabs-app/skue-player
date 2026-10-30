<script setup lang="ts">
import { ref } from 'vue'

withDefaults(defineProps<{
  isLive?: boolean
  isPlaying?: boolean
}>(), {
  isLive: false,
  isPlaying: false
})

const emit = defineEmits<{
  (e: 'rewind'): void
  (e: 'toggle-play'): void
  (e: 'forward'): void
  (e: 'navigate-up'): void
  (e: 'navigate-down'): void
  (e: 'navigate-right'): void
}>()

const rewButtonRef = ref<HTMLButtonElement | null>(null)
const playButtonRef = ref<HTMLButtonElement | null>(null)
const ffButtonRef = ref<HTMLButtonElement | null>(null)

function focusPlay() {
  playButtonRef.value?.focus()
}

function focusRewind() {
  rewButtonRef.value?.focus()
}

function focusForward() {
  ffButtonRef.value?.focus()
}

defineExpose({
  focusPlay,
  focusRewind,
  focusForward,
  playButtonRef,
  rewButtonRef,
  ffButtonRef
})
</script>

<template>
  <div class="flex items-center justify-center gap-4 md:gap-6">
    <!-- Rewind (-10s) -->
    <button
      v-if="!isLive"
      ref="rewButtonRef"
      type="button"
      data-player-action="rewind"
      @click="emit('rewind')"
      @keydown.right.prevent="focusPlay"
      @keydown.up.prevent="emit('navigate-up')"
      @keydown.down.prevent="emit('navigate-down')"
      class="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/80 shadow-[0_8px_25px_rgba(0,0,0,0.25)] backdrop-blur-xl transition hover:scale-105 hover:bg-white/20 hover:text-white focus:scale-105 focus:bg-white/30 focus:text-white focus:ring-2 focus:ring-white/50 focus:outline-none md:h-12 md:w-12"
      aria-label="Retroceder 10 segundos"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="11 19 2 12 11 5 11 19"/>
        <polygon points="22 19 13 12 22 5 22 19"/>
      </svg>
    </button>

    <!-- Play / Pause (Primary Action) -->
    <button
      ref="playButtonRef"
      type="button"
      data-player-action="play"
      @click="emit('toggle-play')"
      @keydown.left.prevent="!isLive ? focusRewind() : null"
      @keydown.right.prevent="!isLive ? focusForward() : emit('navigate-right')"
      @keydown.up.prevent="emit('navigate-up')"
      @keydown.down.prevent="emit('navigate-down')"
      class="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/20 text-white shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition hover:scale-105 hover:bg-white/30 focus:scale-105 focus:bg-white/35 focus:ring-2 focus:ring-white/60 focus:outline-none md:h-[4.25rem] md:w-[4.25rem]"
      aria-label="Alternar reprodução"
    >
      <svg v-if="!isPlaying" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="ml-1">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
      </svg>
    </button>

    <!-- Forward (+10s) -->
    <button
      v-if="!isLive"
      ref="ffButtonRef"
      type="button"
      data-player-action="forward"
      @click="emit('forward')"
      @keydown.left.prevent="focusPlay"
      @keydown.right.prevent="emit('navigate-right')"
      @keydown.up.prevent="emit('navigate-up')"
      @keydown.down.prevent="emit('navigate-down')"
      class="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/80 shadow-[0_8px_25px_rgba(0,0,0,0.25)] backdrop-blur-xl transition hover:scale-105 hover:bg-white/20 hover:text-white focus:scale-105 focus:bg-white/30 focus:text-white focus:ring-2 focus:ring-white/50 focus:outline-none md:h-12 md:w-12"
      aria-label="Avançar 10 segundos"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="13 19 22 12 13 5 13 19"/>
        <polygon points="2 19 11 12 2 5 2 19"/>
      </svg>
    </button>
  </div>
</template>
