import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import OnboardingView from './OnboardingView.vue'

const state = vi.hoisted(() => ({ store: null as any, push: vi.fn() }))
vi.mock('../stores/playlist', () => ({ usePlaylistStore: () => state.store }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: state.push }) }))
vi.mock('qrcode.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../utils/portal', () => ({ getPortalUrl: () => 'https://portal.example.invalid/portal' }))
let wrapper: VueWrapper | undefined

beforeEach(() => {
  vi.clearAllMocks()
  state.store = reactive({
    deviceMac: 'SK:AA:BB:CC:DD:EE', deviceKey: 'SYN234', deviceRemoved: false,
    registrationPending: false, isLoaded: false,
    error: 'A fonte recusou o acesso à lista (HTTP 451).',
    initialize: vi.fn(),
    syncHandshake: vi.fn().mockResolvedValue({ playlists_count: 1 }),
    fetchDeviceConfig: vi.fn().mockResolvedValue([{
      id: 1, type: 'm3u', is_active: true, url: 'https://source.example.invalid/list',
    }]),
    loadConfiguredPlaylist: vi.fn().mockRejectedValue(new Error('restricted')),
  })
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined })

describe('onboarding import errors', () => {
  it('preserves the router initialization failure without automatically repeating the import', async () => {
    wrapper = mount(OnboardingView)
    await flushPromises()
    expect(state.store.initialize).not.toHaveBeenCalled()
    expect(state.store.loadConfiguredPlaylist).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('HTTP 451')
    expect(wrapper.text()).toContain('Conectado ao serviço de ativação. Falha ao carregar a lista.')
    expect(wrapper.text()).not.toContain('Desconectado do serviço de ativação.')
  })

  it('only repeats a failed import when the user explicitly retries', async () => {
    wrapper = mount(OnboardingView)
    await flushPromises()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(state.store.loadConfiguredPlaylist).toHaveBeenCalledTimes(1)
    expect(state.store.syncHandshake).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('HTTP 451')
  })

  it('shows disconnected only when the activation request itself fails', async () => {
    state.store.syncHandshake.mockRejectedValue(new Error('offline'))
    wrapper = mount(OnboardingView)
    await flushPromises()
    expect(wrapper.text()).toContain('Desconectado do serviço de ativação.')
    expect(state.store.loadConfiguredPlaylist).not.toHaveBeenCalled()
  })

  it('distinguishes native transport failure from proxy 451 without showing credentials', async () => {
    state.store.downloadDiagnostics = { direct: 'network-error', proxyAttempted: true, proxyStatus: 451 }
    wrapper = mount(OnboardingView)
    await flushPromises()
    expect(wrapper.text()).toContain('Direto no aparelho: falha de conexão. Servidor: HTTP 451.')
    expect(wrapper.text()).not.toContain('source.example.invalid')
  })
})
