import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TermsModal from './TermsModal.vue'
import { fetchLegalManifest, getCachedLegalManifest, hasConfirmedAcceptance, submitAcceptance } from '../utils/terms'

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))
vi.mock('../utils/device', () => ({ getDeviceMac: async () => 'SK:AA:BB:CC:DD:EE' }))
vi.mock('../utils/terms', () => ({ fetchLegalManifest: vi.fn(), getCachedLegalManifest: vi.fn(), hasConfirmedAcceptance: vi.fn(), submitAcceptance: vi.fn() }))
const documentData = { title: 'Documento', path: '/termos', sections: [{ title: 'Uso', text: 'Fonte própria' }] }
const manifest = { version: 'v1', status: 'Minuta', documents: { terms: documentData, privacy: documentData, notice: documentData } }
let wrapper: ReturnType<typeof mount> | undefined
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(fetchLegalManifest).mockResolvedValue(manifest)
  vi.mocked(getCachedLegalManifest).mockReturnValue(manifest)
  vi.mocked(hasConfirmedAcceptance).mockReturnValue(false)
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined; document.body.innerHTML = '' })
const open = async (props = {}) => { wrapper = mount(TermsModal, { props, global: { stubs: { Teleport: true } } }); await flushPromises(); return wrapper }

describe('terms consent UI', () => {
  it('requires a server-confirmed receipt before closing and emitting accepted', async () => {
    const view = await open()
    expect(view.find('[role="dialog"]').exists()).toBe(true)
    await view.get('button').trigger('click'); await flushPromises()
    expect(submitAcceptance).toHaveBeenCalledWith('SK:AA:BB:CC:DD:EE', 'web', 'v1')
    expect(view.emitted('accepted')).toHaveLength(1)
    expect(view.find('[role="dialog"]').exists()).toBe(false)
  })
  it('keeps the dialog open on failure and reloads texts before an explicit retry', async () => {
    vi.mocked(submitAcceptance).mockRejectedValueOnce(new Error('network'))
    const view = await open()
    await view.get('button').trigger('click'); await flushPromises()
    expect(view.emitted('accepted')).toBeUndefined()
    expect(view.get('[role="alert"]').text()).toContain('Aceite não confirmado')
    expect(view.get('button').text()).toContain('Tentar conexão')
    await view.get('button').trigger('click'); await flushPromises()
    expect(submitAcceptance).toHaveBeenCalledTimes(1)
    expect(view.get('button').text()).toContain('Concordar')
  })
  it('does not allow a first acceptance offline', async () => {
    vi.mocked(fetchLegalManifest).mockRejectedValue(new Error('offline'))
    const view = await open()
    expect(view.get('button').text()).toContain('Tentar conexão')
    expect(submitAcceptance).not.toHaveBeenCalled()
    expect(view.find('[role="dialog"]').exists()).toBe(true)
  })
  it('allows a previous confirmation offline but requires a new version when back online', async () => {
    vi.mocked(fetchLegalManifest).mockRejectedValueOnce(new Error('offline'))
    vi.mocked(hasConfirmedAcceptance).mockImplementation((_device, _platform, version) => version === 'v1')
    const view = await open()
    expect(view.find('[role="dialog"]').exists()).toBe(false)
    vi.mocked(fetchLegalManifest).mockResolvedValue({ ...manifest, version: 'v2' })
    window.dispatchEvent(new Event('online')); await flushPromises()
    expect(view.find('[role="dialog"]').exists()).toBe(true)
    expect(view.text()).toContain('v2')
    expect(submitAcceptance).not.toHaveBeenCalled()
  })
  it('opens the settings reader without requiring or writing another acceptance', async () => {
    const view = await open({ readOnly: true, modelValue: false })
    expect(fetchLegalManifest).not.toHaveBeenCalled()
    await view.setProps({ modelValue: true }); await flushPromises()
    expect(view.text()).toContain('Fechar')
    expect(view.text()).not.toContain('Concordar')
    await view.get('button').trigger('click')
    expect(view.emitted('update:modelValue')?.[0]).toEqual([false])
    expect(submitAcceptance).not.toHaveBeenCalled()
  })
})
