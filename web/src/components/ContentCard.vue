<script setup lang="ts">
import type { PlaylistItem } from '../types/m3u'

defineProps<{
  item: PlaylistItem | { id: string; name?: string; displayName?: string; logo?: string; group?: string; type?: string }
  isPortrait?: boolean
  progress?: number
  showTitle?: boolean
}>()

defineEmits<{
  (e: 'play', item: any): void
}>()

function getDisplayName(item: any) {
  return item.displayName || item.name || ''
}
</script>

<template>
  <div 
    @click="$emit('play', item)"
    @keydown.enter.prevent="$emit('play', item)"
    @keydown.space.prevent="$emit('play', item)"
    @focus="(e) => (e.target as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })"
    tabindex="0"
    class="content-card group cursor-pointer flex flex-col gap-1.5 focus:outline-none transition-all duration-200 relative"
  >
    <!-- Image / Thumbnail Container -->
    <div 
      :class="[
        'relative overflow-hidden bg-gray-900 rounded-md transition-all duration-200 flex items-center justify-center',
        isPortrait ? 'aspect-[2/3] w-full' : 'aspect-video w-full'
      ]"
    >
      <img
        v-if="item.logo"
        :src="item.logo"
        loading="lazy"
        decoding="async"
        :class="[
          'max-w-full max-h-full transition-all duration-300 group-hover:scale-105 group-focus:scale-105',
          isPortrait ? 'w-full h-full object-cover' : (item.type === 'live' ? 'w-full h-full object-cover' : 'object-contain p-2 opacity-85 group-hover:opacity-100 group-focus:opacity-100'),
          progress !== undefined && isPortrait ? 'h-[calc(100%-4px)]' : ''
        ]"
        @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
      />
      <div v-else class="w-full h-full flex items-center justify-center bg-gray-800">
        <span :class="['text-gray-400 font-bold text-center', isPortrait ? 'p-3 text-xs line-clamp-3' : 'text-sm p-2']">
          {{ isPortrait ? getDisplayName(item) : 'RC' }}
        </span>
      </div>

      <!-- Progress Bar (Used in History/Continue Watching) -->
      <div v-if="progress !== undefined" class="absolute bottom-0 left-0 right-0 h-1 bg-gray-800/80 z-20">
        <div class="h-full bg-primary" :style="{ width: progress + '%' }"></div>
      </div>

      <!-- Hover / Focus Play Overlay -->
      <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity flex items-center justify-center z-10">
        <div class="bg-primary text-white rounded-full p-2.5 shadow-xl transform scale-75 group-hover:scale-100 group-focus:scale-100 transition-transform duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </div>
      </div>

      <!-- LIVE badge -->
      <div v-if="item.type === 'live'" class="absolute top-1.5 left-1.5 flex items-center gap-1 bg-red-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded z-20">
        <span class="w-1 h-1 rounded-full bg-white inline-block"></span>
        LIVE
      </div>
    </div>

    <!-- Title / Subtitle Underneath -->
    <p 
      v-if="showTitle !== false && (!isPortrait || showTitle === true)" 
      class="text-xs text-gray-400 group-hover:text-gray-200 group-focus:text-white transition-colors line-clamp-2 leading-snug px-0.5"
    >
      {{ getDisplayName(item) }}
    </p>
  </div>
</template>

