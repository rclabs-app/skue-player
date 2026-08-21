import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, type HistoryItem } from '../lib/database'
import type { PlaylistItem } from '../types/m3u'

export const useHistoryStore = defineStore('history', () => {
  const historyItems = ref<HistoryItem[]>([])
  const isLoaded = ref(false)

  async function loadHistory() {
    try {
      const items = await db.getHistoryItems()
      items.sort((a, b) => b.watchedAt - a.watchedAt)
      historyItems.value = items
      
      const enriched = []
      for (const hist of items) {
         let meta = await db.getPlaylistItemById(hist.id) as PlaylistItem
         if (!meta) meta = await db.getSeriesById(hist.id) as unknown as PlaylistItem
         if (meta) {
           enriched.push({ ...hist, metadata: meta })
         }
      }
      continueWatchingItems.value = enriched
      
      isLoaded.value = true
    } catch (e) {
      console.error('Failed to load history:', e)
    }
  }

  async function updateProgress(id: string, currentTime: number, duration: number) {
    const item: HistoryItem = {
      id,
      currentTime,
      duration,
      watchedAt: Date.now()
    }
    
    // Update local state immediately
    const index = historyItems.value.findIndex(i => i.id === id)
    if (index >= 0) {
      historyItems.value[index] = item
    } else {
      historyItems.value.push(item)
    }
    
    // Re-sort
    historyItems.value.sort((a, b) => b.watchedAt - a.watchedAt)
    
    // Save to DB
    await db.saveHistoryItem(item)
  }

  function getProgress(id: string): HistoryItem | undefined {
    return historyItems.value.find(i => i.id === id)
  }
  
  function getProgressPercentage(id: string): number {
    const item = getProgress(id)
    if (!item || !item.duration) return 0
    return Math.min(100, Math.max(0, (item.currentTime / item.duration) * 100))
  }

  const continueWatchingItems = ref<(HistoryItem & { metadata: PlaylistItem })[]>([])

  // Expose items that are currently in progress (between 1% and 95%)
  const activelyWatching = computed(() => {
    return continueWatchingItems.value.filter(item => {
      const pct = (item.currentTime / item.duration) * 100
      return pct > 1 && pct < 95
    })
  })

  // Full history
  const fullHistory = computed(() => continueWatchingItems.value)

  return {
    historyItems,
    isLoaded,
    loadHistory,
    updateProgress,
    getProgress,
    getProgressPercentage,
    continueWatchingItems,
    activelyWatching,
    fullHistory
  }
})
