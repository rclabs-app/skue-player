import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, type HistoryItem } from '../lib/database'
import type { PlaylistItem } from '../types/m3u'

export const useHistoryStore = defineStore('history', () => {
  const historyItems = ref<HistoryItem[]>([])
  const isLoaded = ref(false)

  function isActiveHistoryItem(item: Pick<HistoryItem, 'currentTime' | 'duration'>): boolean {
    if (!item || !Number.isFinite(item.currentTime)) return false
    if (item.currentTime < 5) return false
    if (item.duration && Number.isFinite(item.duration) && item.duration > 0) {
      const pct = (item.currentTime / item.duration) * 100
      return pct < 95
    }
    return true
  }

  async function resolveMetadata(id: string): Promise<PlaylistItem> {
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

    const sItem = await db.getSeriesById(id)
    if (sItem) {
      return {
        id: sItem.id,
        name: sItem.displayName,
        url: '',
        group: sItem.group || 'Séries',
        logo: sItem.logo,
        type: 'series',
        serieKey: sItem.serieKey
      }
    }

    return {
      id,
      name: 'Item ' + id.slice(0, 8),
      url: '',
      group: 'Outros',
      type: 'movie'
    }
  }

  async function loadHistory() {
    try {
      const items = await db.getHistoryItems()
      items.sort((a, b) => b.watchedAt - a.watchedAt)
      historyItems.value = items

      const enriched = [] as Array<HistoryItem & { metadata: PlaylistItem }>
      for (const hist of items) {
        const meta = await resolveMetadata(hist.id)
        const candidate = { ...hist, metadata: meta }
        if (isActiveHistoryItem(candidate)) {
          enriched.push(candidate)
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

    // Prevent premature / zero-second updates from clearing saved progress
    const existing = historyItems.value.find(i => i.id === id)
    if (safeCurrentTime < 5 && existing && existing.currentTime >= 5) {
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

    const meta = await resolveMetadata(item.id)

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
