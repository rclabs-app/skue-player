<script setup lang="ts">
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
}>()
</script>

<template>
  <div class="flex items-center justify-center gap-4 md:gap-6">
    <button
      v-if="!isLive"
      type="button"
      data-player-action="rewind"
      @click="emit('rewind')"
      class="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/80 shadow-[0_8px_25px_rgba(0,0,0,0.25)] backdrop-blur-xl transition hover:scale-105 hover:bg-white/20 hover:text-white focus:scale-105 focus:bg-white/25 focus:text-white focus:outline-none md:h-12 md:w-12"
      aria-label="Retroceder 10 segundos"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="11 19 2 12 11 5 11 19"/>
        <polygon points="22 19 13 12 22 5 22 19"/>
      </svg>
    </button>

    <button
      type="button"
      data-player-action="play"
      @click="emit('toggle-play')"
      class="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/15 text-white shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition hover:scale-105 hover:bg-white/25 focus:scale-105 focus:bg-white/30 focus:outline-none md:h-[4.25rem] md:w-[4.25rem]"
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

    <button
      v-if="!isLive"
      type="button"
      data-player-action="forward"
      @click="emit('forward')"
      class="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/80 shadow-[0_8px_25px_rgba(0,0,0,0.25)] backdrop-blur-xl transition hover:scale-105 hover:bg-white/20 hover:text-white focus:scale-105 focus:bg-white/25 focus:text-white focus:outline-none md:h-12 md:w-12"
      aria-label="Avançar 10 segundos"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="13 19 22 12 13 5 13 19"/>
        <polygon points="2 19 11 12 2 5 2 19"/>
      </svg>
    </button>
  </div>
</template>
