import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useHistoryStore } from './history'
import { db } from '../lib/database'

vi.mock('../lib/database', () => {
  const store = {
    history: [] as any[],
    playlist: new Map<string, any>(),
    series: new Map<string, any>()
  }
  return {
    db: {
      getHistoryItems: vi.fn(async () => [...store.history]),
      saveHistoryItem: vi.fn(async (item: any) => {
        const idx = store.history.findIndex(h => h.id === item.id)
        if (idx >= 0) store.history[idx] = item
        else store.history.push(item)
      }),
      getPlaylistItemById: vi.fn(async (id: string) => store.playlist.get(id) || null),
      getSeriesById: vi.fn(async (id: string) => store.series.get(id) || null),
      getSeriesByKey: vi.fn(async (key: string) => {
        for (const s of store.series.values()) {
          if (s.serieKey === key) return s
        }
        return null
      }),
      _reset: () => {
        store.history = []
        store.playlist.clear()
        store.series.clear()
      },
      _setPlaylist: (items: any[]) => {
        for (const it of items) store.playlist.set(it.id, it)
      },
      _setSeries: (items: any[]) => {
        for (const it of items) store.series.set(it.id, it)
      }
    }
  }
})

describe('HistoryStore - Continuar Assistindo', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ;(db as any)._reset()
    vi.clearAllMocks()
  })

  it('qualifies items watched for at least 5 seconds as actively watching', async () => {
    ;(db as any)._setPlaylist([
      { id: 'movie-1', name: 'Inception', type: 'movie', duration: 7200 }
    ])

    const store = useHistoryStore()
    
    // 3 seconds - too short, should not qualify
    await store.updateProgress('movie-1', 3, 7200)
    expect(store.continueWatchingItems.length).toBe(0)

    // 10 seconds (less than 2% of a 2h movie, but >= 5s) - should now qualify!
    await store.updateProgress('movie-1', 10, 7200)
    expect(store.continueWatchingItems.length).toBe(1)
    expect(store.continueWatchingItems[0].id).toBe('movie-1')
    expect(store.continueWatchingItems[0].currentTime).toBe(10)
  })

  it('removes items when watched past 95% completion (finished)', async () => {
    ;(db as any)._setPlaylist([
      { id: 'movie-1', name: 'Inception', type: 'movie', duration: 100 }
    ])

    const store = useHistoryStore()
    
    // Halfway (50%) -> in continue watching
    await store.updateProgress('movie-1', 50, 100)
    expect(store.continueWatchingItems.length).toBe(1)

    // 96% -> completed, should be removed from continue watching
    await store.updateProgress('movie-1', 96, 100)
    expect(store.continueWatchingItems.length).toBe(0)
  })

  it('protects against premature zero-second ticks overwriting existing progress', async () => {
    ;(db as any)._setPlaylist([
      { id: 'movie-1', name: 'Inception', type: 'movie', duration: 7200 }
    ])

    const store = useHistoryStore()
    
    // User was at 45 minutes (2700s)
    await store.updateProgress('movie-1', 2700, 7200)
    expect(store.getProgress('movie-1')?.currentTime).toBe(2700)

    // Player loads and emits an initial tick of 1s before seek
    await store.updateProgress('movie-1', 1, 7200)
    // Saved progress should NOT be erased
    expect(store.getProgress('movie-1')?.currentTime).toBe(2700)
    expect(store.continueWatchingItems.length).toBe(1)
  })

  it('groups multiple episodes of the same series by serieKey in continue watching', async () => {
    ;(db as any)._setPlaylist([
      { id: 'ep-1', name: 'Dark S01E01', type: 'series', serieKey: 'dark' },
      { id: 'ep-2', name: 'Dark S01E02', type: 'series', serieKey: 'dark' }
    ])
    ;(db as any)._setSeries([
      { id: 'series-dark', displayName: 'Dark', serieKey: 'dark', logo: 'http://example.com/dark.jpg' }
    ])

    const store = useHistoryStore()
    
    // Watch episode 1
    await store.updateProgress('ep-1', 300, 3600)
    expect(store.continueWatchingItems.length).toBe(1)
    expect(store.continueWatchingItems[0].id).toBe('ep-1')
    expect(store.continueWatchingItems[0].metadata.logo).toBe('http://example.com/dark.jpg')

    // Later watch episode 2
    await store.updateProgress('ep-2', 150, 3600)
    // Should still only have ONE entry for the series Dark (the most recent episode 2)
    expect(store.continueWatchingItems.length).toBe(1)
    expect(store.continueWatchingItems[0].id).toBe('ep-2')
  })
})
