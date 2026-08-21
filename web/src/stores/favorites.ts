import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '../lib/database'

export const useFavoritesStore = defineStore('favorites', () => {
  const favoriteIds = ref<string[]>([])
  const isLoaded = ref(false)

  async function loadFavorites() {
    try {
      favoriteIds.value = await db.getFavorites()
      isLoaded.value = true
    } catch (e) {
      console.error('Failed to load favorites:', e)
    }
  }

  async function toggleFavorite(id: string) {
    const index = favoriteIds.value.indexOf(id)
    if (index >= 0) {
      favoriteIds.value.splice(index, 1)
      await db.removeFavorite(id)
    } else {
      favoriteIds.value.push(id)
      await db.addFavorite(id)
    }
  }

  function isFavorite(id: string): boolean {
    return favoriteIds.value.includes(id)
  }

  return {
    favoriteIds,
    isLoaded,
    loadFavorites,
    toggleFavorite,
    isFavorite
  }
})
