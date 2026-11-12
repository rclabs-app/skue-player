import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ContentCard from '../components/ContentCard.vue'
import Movies from './MoviesView.vue'
import Series from './SeriesView.vue'
import Live from './LiveView.vue'
import Home from './HomeView.vue'
const data = vi.hoisted(() => ({
  items: [
    { id: 'a', name: 'Alpha', displayName: 'Alpha', group: 'Action', type: 'movie', url: '/a', serieKey: 'a' },
    { id: 'b', name: 'Beta', displayName: 'Beta', group: 'Drama', type: 'movie', url: '/b', serieKey: 'b' },
  ],
  category: vi.fn(),
}))
vi.mock('../stores/playlist', () => ({ usePlaylistStore: () => ({ isLoaded: true, uniqueSeries: data.items }) }))
vi.mock('../stores/favorites', () => ({ useFavoritesStore: () => ({ loadFavorites: async () => {}, isFavorite: () => false }) }))
vi.mock('../stores/history', () => ({ useHistoryStore: () => ({ loadHistory: async () => {}, activelyWatching: [], recentlyWatchedLive: [] }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../composables/useSpatialNav', () => ({ useSpatialNav: () => ({ registerZone() {}, setZoneRule() {}, activate() {}, focusZone() {} }) }))
vi.mock('../composables/useTvRemote', () => ({ useTvRemote: () => ({ onRemoteKey() {} }) }))
vi.mock('../services/tmdb.service', () => ({ TMDBService: { getMetadata: async () => ({ overview: '', backdrop_url: null }) } }))
vi.mock('../lib/database', () => ({ db: {
  getCategoriesWithCount: async () => [{ name: 'Drama', count: 1 }, { name: 'Action', count: 1 }],
  getPlaylistItems: async () => data.items,
  getPlaylistItemCount: async () => 2,
  getFavorites: async () => [],
  getRecentItems: async () => data.items.map(item => ({ ...item, logo: 'https://example.invalid/poster.png' })),
  getRecentSeries: async () => [],
  getTopCategories: async () => [],
  getItemsByCategoryAndType: (...args: unknown[]) => data.category(...args),
  searchItemsByType: async () => [],
} }))
const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
  data.category.mockImplementation(async (group: string) => data.items.filter(i => i.group === group))
})
afterEach(() => {
  wrappers.forEach(w => w.unmount())
  wrappers.length = 0
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
async function open(component: typeof Movies | typeof Series | typeof Live | typeof Home) {
  const w = mount(component, { global: { stubs: { ContentCard: true, VideoPlayer: true } } })
  wrappers.push(w)
  await flushPromises()
  await vi.advanceTimersByTimeAsync(500)
  return w
}
async function category(w: ReturnType<typeof mount>, label: string) {
  const button = w.findAll('button').find(b => b.text().includes(label))!
  await button.trigger('click')
  await flushPromises()
}
describe('catalog hero follows the active list', () => {
  it('renders the home hero and retains playback actions without a program guide', async () => {
    const w = await open(Home)
    expect(w.find('#hero-banner').text()).toContain('Alpha')
    expect(w.find('#hero-banner').text()).toContain('Selecione para assistir agora.')
    expect(w.find('#btn-ver-mais').exists()).toBe(true)
    expect(w.text()).not.toContain('Programação indisponível')
  })
  it.each([['movies', Movies], ['series', Series], ['live', Live]] as const)('%s changes hero after hover and category switch, and clears empty lists', async (_name, component) => {
    const w = await open(component)
    await w.findAllComponents({ name: 'ContentCard' })[0].trigger('mouseenter')
    await category(w, 'Drama')
    const vm = w.vm as unknown as { currentHero?: { id: string }; focusedChannel?: { id: string } }
    expect((vm.currentHero || vm.focusedChannel)?.id).toBe('b')
    await category(w, 'Favoritos')
    expect(vm.currentHero || vm.focusedChannel).toBeFalsy()
  })
  it.each([['movies', Movies], ['series', Series], ['live', Live]] as const)('%s retains the last highlight after pointer and focus leave', async (_name, component) => {
    const w = await open(component)
    const cards = w.findAllComponents({ name: 'ContentCard' })
    const vm = w.vm as unknown as { currentHero?: { id: string }; focusedChannel?: { id: string } }
    await cards[1].trigger('mouseenter')
    await cards[1].trigger('mouseleave')
    await cards[1].trigger('blur')
    await vi.advanceTimersByTimeAsync(12000)
    expect((vm.currentHero || vm.focusedChannel)?.id).toBe('b')
    await cards[0].trigger('focus')
    await cards[0].trigger('blur')
    expect((vm.currentHero || vm.focusedChannel)?.id).toBe('a')
    await category(w, 'Drama')
    expect((vm.currentHero || vm.focusedChannel)?.id).toBe('b')
  })
  it('ignores an older category response arriving last', async () => {
    const w = await open(Movies)
    let resolveOld!: (value: typeof data.items) => void
    data.category.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    await category(w, 'Drama')
    await category(w, 'Action')
    resolveOld([data.items[1]])
    await flushPromises()
    expect((w.vm as unknown as { currentHero: { id: string } }).currentHero.id).toBe('a')
  })
  it('resets live highlight when playback closes', async () => {
    const w = await open(Live)
    const cards = w.findAllComponents({ name: 'ContentCard' })
    await cards[1].trigger('mouseenter')
    cards[1].vm.$emit('play', data.items[1])
    await flushPromises()
    w.findComponent({ name: 'VideoPlayer' }).vm.$emit('close')
    await flushPromises()
    expect((w.vm as unknown as { focusedChannel: { id: string } }).focusedChannel.id).toBe('a')
  })
  it('renders square channel cards in LiveView while preserving portrait/video defaults', async () => {
    const w = await open(Live)
    const liveCard = w.findComponent({ name: 'ContentCard' })
    expect(liveCard.props('isSquare')).toBe(true)
    expect(liveCard.props('isPortrait')).toBe(false)

    const squareWrapper = mount(ContentCard, {
      props: {
        item: { id: 'ch1', name: 'Canal 1', logo: 'https://example.com/logo.png', type: 'live' },
        isPortrait: false,
        isSquare: true,
        showTitle: true,
      },
    })
    wrappers.push(squareWrapper)
    expect(squareWrapper.find('.aspect-square').exists()).toBe(true)
    expect(squareWrapper.find('img').attributes('src')).toContain('w=360&h=360')
  })
})
