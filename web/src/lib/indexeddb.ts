import type { PlaylistItem, SeriesEntry } from '../types/m3u'
import type { EPGProgram } from '../types/epg'

export interface HistoryItem {
  id: string; // The playlist item ID
  currentTime: number;
  duration: number;
  watchedAt: number; // timestamp
}

const DB_NAME = 'rc-player-db'
const DB_VERSION = 4
const STORE_PLAYLIST = 'playlist'
const STORE_SERIES_INDEX = 'series_index'
const STORE_FAVORITES = 'favorites'
const STORE_HISTORY = 'history'
const STORE_CONFIG = 'config'
const STORE_EPG = 'epg'
const STORE_TMDB_CACHE = 'tmdb_cache'

export interface TMDBMetadata {
  id: string; // The playlist item ID
  overview: string | null;
  backdrop_url: string | null;
  cachedAt: number;
}

export class DatabaseService {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(STORE_PLAYLIST)) {
          const store = db.createObjectStore(STORE_PLAYLIST, { keyPath: 'id' })
          store.createIndex('type', 'type', { unique: false })
          store.createIndex('group', 'group', { unique: false })
          store.createIndex('serieKey', 'serieKey', { unique: false })
        } else {
          // Migration: add serieKey index if upgrading from v3
          const tx = (event as IDBVersionChangeEvent & { currentTarget: IDBOpenDBRequest }).currentTarget
          const existingStore = (tx as any).transaction?.objectStore(STORE_PLAYLIST)
          if (existingStore && !existingStore.indexNames.contains('serieKey')) {
            existingStore.createIndex('serieKey', 'serieKey', { unique: false })
          }
        }

        if (!db.objectStoreNames.contains(STORE_SERIES_INDEX)) {
          const si = db.createObjectStore(STORE_SERIES_INDEX, { keyPath: 'id' })
          si.createIndex('serieKey', 'serieKey', { unique: true })
          si.createIndex('group', 'group', { unique: false })
        }

        if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
          db.createObjectStore(STORE_FAVORITES, { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains(STORE_HISTORY)) {
          db.createObjectStore(STORE_HISTORY, { keyPath: 'id' })
        }
        
        if (!db.objectStoreNames.contains(STORE_CONFIG)) {
          db.createObjectStore(STORE_CONFIG, { keyPath: 'key' })
        }

        if (!db.objectStoreNames.contains(STORE_EPG)) {
          const store = db.createObjectStore(STORE_EPG, { keyPath: 'id' })
          store.createIndex('channelId', 'channelId', { unique: false })
          store.createIndex('startTime', 'startTime', { unique: false })
          store.createIndex('endTime', 'endTime', { unique: false })
        }

        if (!db.objectStoreNames.contains(STORE_TMDB_CACHE)) {
          db.createObjectStore(STORE_TMDB_CACHE, { keyPath: 'id' })
        }
      }
    })
  }

  async clearPlaylist(): Promise<void> {
    await this.clearStore(STORE_PLAYLIST)
    await this.clearStore(STORE_SERIES_INDEX)
  }

  // ─── Series Index ────────────────────────────────────────────────────────

  async saveSeriesIndex(entries: SeriesEntry[]): Promise<void> {
    if (!this.db) await this.init()
    const CHUNK_SIZE = 2_000
    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const chunk = entries.slice(i, i + CHUNK_SIZE)
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction(STORE_SERIES_INDEX, 'readwrite')
        const store = tx.objectStore(STORE_SERIES_INDEX)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        for (const entry of chunk) store.put(entry)
      })
    }
  }

  async getSeriesIndex(): Promise<SeriesEntry[]> {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_SERIES_INDEX, 'readonly')
      const store = tx.objectStore(STORE_SERIES_INDEX)
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result as SeriesEntry[])
      req.onerror = () => reject(req.error)
    })
  }

  /**
   * Returns all episodes belonging to a series, identified by serieKey.
   * This is the on-demand query called from the Details view — NOT loaded
   * at startup, so 200k episodes never sit in RAM until actually needed.
   */
  async getEpisodesBySerieKey(serieKey: string): Promise<PlaylistItem[]> {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_PLAYLIST, 'readonly')
      const store = tx.objectStore(STORE_PLAYLIST)
      const index = store.index('serieKey')
      const req = index.getAll(serieKey)
      req.onsuccess = () => resolve(req.result as PlaylistItem[])
      req.onerror = () => reject(req.error)
    })
  }

  async savePlaylistItems(items: PlaylistItem[], onProgress?: (saved: number, total: number) => void): Promise<void> {
    if (!this.db) await this.init()
    
    // Batch size of 5000 is safe for most TV browsers without causing timeouts
    const CHUNK_SIZE = 5000;
    
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction(STORE_PLAYLIST, 'readwrite')
        const store = transaction.objectStore(STORE_PLAYLIST)
        
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        
        for (const item of chunk) {
          store.put(item)
        }
      })
      if (onProgress) {
        onProgress(Math.min(i + CHUNK_SIZE, items.length), items.length)
      }
    }
  }

  async getPlaylistItems(type?: 'live' | 'movie' | 'series', limit = 0, offset = 0): Promise<PlaylistItem[]> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_PLAYLIST, 'readonly')
      const store = transaction.objectStore(STORE_PLAYLIST)
      let request: IDBRequest
      
      if (type) {
        const index = store.index('type')
        request = index.getAll(type)
      } else {
        request = store.getAll()
      }
      
      request.onsuccess = () => {
        let results = request.result as PlaylistItem[]
        if (limit > 0) {
          results = results.slice(offset, offset + limit)
        }
        resolve(results)
      }
      request.onerror = () => reject(request.error)
    })
  }
  
  async getCategories(type: 'live' | 'movie' | 'series'): Promise<string[]> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_PLAYLIST, 'readonly')
      const store = transaction.objectStore(STORE_PLAYLIST)
      const index = store.index('type')
      const categories = new Set<string>()
      
      const cursorRequest = index.openCursor(IDBKeyRange.only(type))
      
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result
        if (!cursor) {
          resolve(Array.from(categories).sort())
          return
        }
        
        const item = cursor.value as PlaylistItem
        categories.add(item.group)
        cursor.continue()
      }
      cursorRequest.onerror = () => reject(cursorRequest.error)
    })
  }
  
  async getItemsByCategory(group: string): Promise<PlaylistItem[]> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_PLAYLIST, 'readonly')
      const store = transaction.objectStore(STORE_PLAYLIST)
      const index = store.index('group')
      
      const request = index.getAll(group)
      
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  
  async searchItems(query: string, maxResults = 100): Promise<PlaylistItem[]> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_PLAYLIST, 'readonly')
      const store = transaction.objectStore(STORE_PLAYLIST)
      const results: PlaylistItem[] = []
      const lowerQuery = query.toLowerCase()
      
      const cursorRequest = store.openCursor()
      
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result
        if (!cursor || results.length >= maxResults) {
          resolve(results)
          return
        }
        
        const item = cursor.value as PlaylistItem
        if (
          item.name.toLowerCase().includes(lowerQuery) || 
          item.group.toLowerCase().includes(lowerQuery)
        ) {
          results.push(item)
        }
        
        cursor.continue()
      }
      cursorRequest.onerror = () => reject(cursorRequest.error)
    })
  }

  async saveConfig<T>(key: string, value: T): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_CONFIG, 'readwrite')
      const store = transaction.objectStore(STORE_CONFIG)
      const request = store.put({ key, value })
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getConfig<T>(key: string): Promise<T | null> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_CONFIG, 'readonly')
      const store = transaction.objectStore(STORE_CONFIG)
      const request = store.get(key)
      
      request.onsuccess = () => {
        resolve(request.result ? (request.result.value as T) : null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async saveHistoryItem(item: HistoryItem): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_HISTORY, 'readwrite')
      const store = transaction.objectStore(STORE_HISTORY)
      const request = store.put(item)
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getHistoryItems(): Promise<HistoryItem[]> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_HISTORY, 'readonly')
      const store = transaction.objectStore(STORE_HISTORY)
      const request = store.getAll()
      
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  async getHistoryItem(id: string): Promise<HistoryItem | null> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_HISTORY, 'readonly')
      const store = transaction.objectStore(STORE_HISTORY)
      const request = store.get(id)
      
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async clearHistory(): Promise<void> {
    await this.clearStore(STORE_HISTORY)
  }

  async addFavorite(id: string): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_FAVORITES, 'readwrite')
      const store = transaction.objectStore(STORE_FAVORITES)
      const request = store.put({ id })
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async removeFavorite(id: string): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_FAVORITES, 'readwrite')
      const store = transaction.objectStore(STORE_FAVORITES)
      const request = store.delete(id)
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getFavorites(): Promise<string[]> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_FAVORITES, 'readonly')
      const store = transaction.objectStore(STORE_FAVORITES)
      const request = store.getAll()
      
      request.onsuccess = () => {
        resolve((request.result || []).map((item: any) => item.id))
      }
      request.onerror = () => reject(request.error)
    })
  }

  async saveEpgPrograms(programs: EPGProgram[]): Promise<void> {
    if (!this.db) await this.init()
    
    const CHUNK_SIZE = 5000;
    for (let i = 0; i < programs.length; i += CHUNK_SIZE) {
      const chunk = programs.slice(i, i + CHUNK_SIZE);
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction(STORE_EPG, 'readwrite')
        const store = transaction.objectStore(STORE_EPG)
        
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        
        for (const item of chunk) {
          store.put(item)
        }
      })
    }
  }

  async getEpgPrograms(channelId: string): Promise<EPGProgram[]> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_EPG, 'readonly')
      const store = transaction.objectStore(STORE_EPG)
      const index = store.index('channelId')
      const request = index.getAll(channelId)
      
      request.onsuccess = () => {
        const results = (request.result || []) as EPGProgram[]
        // Sort by start time ascending
        results.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
        resolve(results)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getCurrentEpgProgram(channelId: string, time: Date = new Date()): Promise<EPGProgram | null> {
    if (!this.db) await this.init()
    
    const t = time.getTime()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_EPG, 'readonly')
      const store = transaction.objectStore(STORE_EPG)
      const index = store.index('channelId')
      const cursorRequest = index.openCursor(IDBKeyRange.only(channelId))
      
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result
        if (!cursor) {
          resolve(null)
          return
        }
        
        const p = cursor.value as EPGProgram
        const startMs = p.startTime instanceof Date ? p.startTime.getTime() : new Date(p.startTime).getTime()
        const endMs = p.endTime instanceof Date ? p.endTime.getTime() : new Date(p.endTime).getTime()
        
        if (startMs <= t && endMs > t) {
          resolve(p)
          return
        }
        
        cursor.continue()
      }
      cursorRequest.onerror = () => reject(cursorRequest.error)
    })
  }

  async clearEpg(): Promise<void> {
    await this.clearStore(STORE_EPG)
  }

  async saveTMDBMetadata(metadata: TMDBMetadata): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_TMDB_CACHE, 'readwrite')
      const store = transaction.objectStore(STORE_TMDB_CACHE)
      const request = store.put(metadata)
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getTMDBMetadata(id: string): Promise<TMDBMetadata | null> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_TMDB_CACHE, 'readonly')
      const store = transaction.objectStore(STORE_TMDB_CACHE)
      const request = store.get(id)
      
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  private async clearStore(storeName: string): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.clear()
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
}

export const db = new DatabaseService()
