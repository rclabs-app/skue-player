import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, type HistoryItem } from '../lib/database'
import type { PlaylistItem } from '../types/m3u'

export const useHistoryStore = defineStore('history', () => {
  const historyItems = ref<HistoryItem[]>([])
  const isLoaded = ref(false)

  function isActiveHistoryItem(item: Pick<HistoryItem, 'currentTime' | 'duration'>): boolean {
    if (!item || !Number.isFinite(item.currentTime) || !Number.isFinite(item.duration)) return false
    if (item.duration <= 0) return false
    const pct = (item.currentTime / item.duration) * 100
    return item.currentTime > 15 && pct > 2 && pct < 95
  }

  async function loadHistory() {
    try {
      const items = await db.getHistoryItems()
      items.sort((a, b) => b.watchedAt - a.watchedAt)
      historyItems.value = items

      const enriched = [] as Array<HistoryItem & { metadata: PlaylistItem }>
      for (const hist of items) {
        let meta = await db.getPlaylistItemById(hist.id) as PlaylistItem
        if (!meta) meta = await db.getSeriesById(hist.id) as unknown as PlaylistItem
        if (meta) {
          const candidate = { ...hist, metadata: meta }
          if (isActiveHistoryItem(candidate)) {
            enriched.push(candidate)
          }
        }
      }

      const uniqueEnriched = [] as Array<HistoryItem & { metadata: PlaylistItem }>
      const seen = new Set<string>()
      for (const e of enriched) {
        if (!seen.has(e.id)) {
          seen.add(e.id)
          uniqueEnriched.push(e)
        }
      }

      continueWatchingItems.value = uniqueEnriched
      isLoaded.value = true
    } catch (e) {
      console.error('Failed to load history:', e)
    }
  }

  async function updateProgress(id: string, currentTime: number, duration: number) {
    const safeCurrentTime = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0
    const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0
    const item: HistoryItem = {
      id,
      currentTime: safeCurrentTime,
      duration: safeDuration,
      watchedAt: Date.now()
    }

    const index = historyItems.value.findIndex(i => i.id === id)
    if (index >= 0) {
      historyItems.value[index] = item
    } else {
      historyItems.value.push(item)
    }

    historyItems.value.sort((a, b) => b.watchedAt - a.watchedAt)

    const existingIndex = continueWatchingItems.value.findIndex(i => i.id === id)
    let meta = await db.getPlaylistItemById(item.id) as PlaylistItem
    if (!meta) meta = await db.getSeriesById(item.id) as unknown as PlaylistItem

    const entry = meta ? { ...item, metadata: meta } : null

    if (entry && isActiveHistoryItem(item)) {
      if (existingIndex >= 0) {
        continueWatchingItems.value[existingIndex] = entry
      } else {
        continueWatchingItems.value.unshift(entry)
      }
    } else if (existingIndex >= 0) {
      continueWatchingItems.value.splice(existingIndex, 1)
    }

    continueWatchingItems.value = continueWatchingItems.value.filter(it => isActiveHistoryItem(it))

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

  const activelyWatching = computed(() => {
    return continueWatchingItems.value.filter(item => isActiveHistoryItem(item))
  })

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
