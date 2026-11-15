import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import DetailsView from './DetailsView.vue'
import { XtreamError } from '../lib/xtream'

const state = vi.hoisted(() => ({ episodes: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: 'synthetic' } }), useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }))
vi.mock('../stores/playlist', () => ({ usePlaylistStore: () => ({ isLoaded: true, getSeriesEpisodes: state.episodes }) }))
vi.mock('../stores/favorites', () => ({ useFavoritesStore: () => ({ loadFavorites: vi.fn(), isFavorite: () => false }) }))
vi.mock('../stores/history', () => ({ useHistoryStore: () => ({ loadHistory: vi.fn(), historyItems: [], getProgress: () => undefined }) }))
vi.mock('../services/tmdb.service', () => ({ TMDBService: { getMetadata: async () => null } }))
vi.mock('../lib/database', () => ({ db: {
  getPlaylistItemById: async () => null,
  getSeriesById: async () => ({ id: 'synthetic', displayName: 'Synthetic series', serieKey: 'synthetic-key', group: 'Series' }),
} }))

afterEach(() => vi.restoreAllMocks())

describe('series episode loading', () => {
  it('shows the safe HTTP status without displaying arbitrary exception text', async () => {
    state.episodes.mockReset().mockRejectedValue(new XtreamError('synthetic-private-error', 451))
    const wrapper = mount(DetailsView, { global: { stubs: { VideoPlayer: true } } })
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('HTTP 451')
    expect(wrapper.text()).not.toContain('synthetic-private-error')
    wrapper.unmount()
  })
  it('never opens an empty series URL, and allows a failed episode request to be retried', async () => {
    state.episodes.mockReset().mockRejectedValueOnce(new Error('synthetic-private-error'))
      .mockResolvedValueOnce([{ id: 'episode', name: 'Synthetic S01E01', url: 'https://media.example.invalid/series/1.mp4', type: 'series', group: 'Series' }])
    const wrapper = mount(DetailsView, { global: { stubs: { VideoPlayer: { props: ['url'], template: '<div data-player>{{ url }}</div>' } } } })
    await flushPromises()
    expect(wrapper.find('#btn-play').attributes('disabled')).toBeDefined()
    await wrapper.find('#btn-play').trigger('click')
    expect(wrapper.find('[data-player]').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').text()).toContain('Não foi possível consultar')
    expect(wrapper.text()).not.toContain('synthetic-private-error')
    const retry = wrapper.findAll('button').find(button => button.text() === 'Consultar episódios novamente')!
    await retry.trigger('click')
    await flushPromises()
    expect(wrapper.find('#btn-play').attributes('disabled')).toBeUndefined()
    await wrapper.find('#btn-play').trigger('click')
    expect(wrapper.find('[data-player]').text()).toContain('/series/1.mp4')
    wrapper.unmount()
  })
})
