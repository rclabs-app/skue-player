import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, type HistoryItem } from '../lib/database'
import type { PlaylistItem } from '../types/m3u'

export const useHistoryStore = defineStore('history', () => {
  const historyItems = ref<HistoryItem[]>([])
  const isLoaded = ref(false)
  const recentlyWatchedLive = ref<(HistoryItem & { metadata: PlaylistItem })[]>([])

  function isActiveHistoryItem(item: Pick<HistoryItem, 'currentTime' | 'duration'>): boolean {
    if (!item || !Number.isFinite(item.currentTime)) return false
    if (item.currentTime < 5) return false
    if (item.duration && Number.isFinite(item.duration) && item.duration > 0) {
      const pct = (item.currentTime / item.duration) * 100
      return pct < 95
    }
    return true
  }

  async function resolveMetadata(id: string): Promise<PlaylistItem | null> {
    const pItem = await db.getPlaylistItemById(id)
    if (pItem) {
      if (pItem.type === 'series' && pItem.serieKey && !pItem.logo) {
        const seriesEntry = await db.getSeriesByKey(pItem.serieKey)
        if (seriesEntry && seriesEntry.logo) {
          pItem.logo = seriesEntry.logo
        }
      }
      return pItem
    }

    return null
  }

  async function loadHistory() {
    try {
      const items = await db.getHistoryItems()
      items.sort((a, b) => b.watchedAt - a.watchedAt)
      historyItems.value = items

      const recentLive: (HistoryItem & { metadata: PlaylistItem })[] = []
      const enriched = [] as Array<HistoryItem & { metadata: PlaylistItem }>
      for (const hist of items) {
        const meta = await resolveMetadata(hist.id)
        if (meta?.type === 'live') recentLive.push({ ...hist, metadata: meta })
        if (meta && meta.type !== 'live' && hist.currentTime >= 5) {
          enriched.push({ ...hist, metadata: meta })
        }
      }

      const uniqueEnriched = [] as Array<HistoryItem & { metadata: PlaylistItem }>
      const seen = new Set<string>()
      for (const e of enriched) {
        const dedupeKey = e.metadata.type === 'series' && e.metadata.serieKey
          ? `series:${e.metadata.serieKey}`
          : e.id
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey)
          if (isActiveHistoryItem(e)) uniqueEnriched.push(e)
        }
      }

      recentlyWatchedLive.value = recentLive
      continueWatchingItems.value = uniqueEnriched
      isLoaded.value = true
    } catch (e) {
      console.error('Failed to load history:', e)
    }
  }

  async function recordLiveView(id: string) {
    const metadata = await resolveMetadata(id)
    if (!metadata || metadata.type !== 'live') return
    const item: HistoryItem = { id, currentTime: 0, duration: 0, watchedAt: Date.now() }
    await db.saveHistoryItem(item)
    historyItems.value = [item, ...historyItems.value.filter(h => h.id !== id)]
    recentlyWatchedLive.value = [{ ...item, metadata }, ...recentlyWatchedLive.value.filter(h => h.id !== id)]
  }

  async function updateProgress(id: string, currentTime: number, duration: number) {
    const safeCurrentTime = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0
    const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0

    // Prevent premature / zero-second updates from clearing saved progress
    if (safeCurrentTime < 5) {
      return
    }

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

    await db.saveHistoryItem(item)
    const meta = await resolveMetadata(item.id)
    if (!meta || meta.type === 'live') return

    const dedupeKey = meta.type === 'series' && meta.serieKey
      ? `series:${meta.serieKey}`
      : item.id

    const existingIndex = continueWatchingItems.value.findIndex(i => {
      const itDedupeKey = i.metadata.type === 'series' && i.metadata.serieKey
        ? `series:${i.metadata.serieKey}`
        : i.id
      return itDedupeKey === dedupeKey
    })

    const entry = { ...item, metadata: meta }

    if (isActiveHistoryItem(item)) {
      if (existingIndex >= 0) {
        continueWatchingItems.value.splice(existingIndex, 1)
        continueWatchingItems.value.unshift(entry)
      } else {
        continueWatchingItems.value.unshift(entry)
      }
    } else if (existingIndex >= 0) {
      continueWatchingItems.value.splice(existingIndex, 1)
    }

    continueWatchingItems.value = continueWatchingItems.value.filter(it => isActiveHistoryItem(it))

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
    recentlyWatchedLive,
    recordLiveView,
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
