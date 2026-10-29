<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  subtitle?: string
  isLive?: boolean
  currentClock?: string
}>(), {
  title: 'Reproduzindo',
  subtitle: 'TV • Reprodução',
  isLive: false,
  currentClock: '00:00'
})

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <div class="pointer-events-auto flex w-full items-center justify-between gap-3 rounded-full border border-white/10 bg-black/20 px-3 py-2 shadow-[0_8px_25px_rgba(0,0,0,0.25)] backdrop-blur-xl">
    <div class="flex items-center gap-3 min-w-0">
      <button
        type="button"
        @click="emit('close')"
        class="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20 focus:bg-white/25 focus:outline-none"
        aria-label="Fechar player"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>

      <div class="min-w-0">
        <div class="flex items-center gap-2 min-w-0">
          <span
            v-if="isLive"
            class="inline-flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-white shadow-sm"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-white" />
            LIVE
          </span>
          <p class="truncate text-sm font-bold text-white md:text-base">
            {{ title || 'Reproduzindo' }}
          </p>
        </div>
        <p class="truncate text-[10px] text-white/70 md:text-xs">
          {{ subtitle }}
        </p>
      </div>
    </div>

    <div class="flex items-center gap-2 shrink-0">
      <span class="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
        FHD
      </span>
      <div class="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-emerald-200">
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        {{ currentClock }}
      </div>
    </div>
  </div>
</template>
