import { ref, computed, watch, type Ref } from 'vue'

const DEFAULT_PAGE_SIZE = 60

/**
 * Paginated list composable for progressive rendering.
 * Renders only `pageSize` items at a time, appending more on demand.
 */
export function usePagedList<T>(
  source: Ref<T[]> | (() => T[]),
  pageSize = DEFAULT_PAGE_SIZE
) {
  const page = ref(1)

  const sourceList = typeof source === 'function' ? computed(source) : source

  // Reset pagination whenever the source list changes (e.g. category switch)
  watch(sourceList, () => {
    page.value = 1
  })

  const visibleItems = computed(() =>
    sourceList.value.slice(0, page.value * pageSize)
  )

  const hasMore = computed(() =>
    visibleItems.value.length < sourceList.value.length
  )

  function loadMore() {
    if (hasMore.value) {
      page.value++
    }
  }

  return { visibleItems, hasMore, loadMore }
}
