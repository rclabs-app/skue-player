import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@capacitor/preferences', () => ({ Preferences: { get: vi.fn(async () => ({ value: null })), set: vi.fn(async () => {}) } }))
vi.mock('@capacitor/device', () => ({ Device: { getId: vi.fn(async () => ({ identifier: '' })) } }))
afterEach(() => { localStorage.clear(); vi.resetModules(); vi.clearAllMocks() })

it('shares one identity resolution between router startup and terms acceptance', async () => {
  localStorage.clear()
  const { Device } = await import('@capacitor/device')
  const { getDeviceMac } = await import('./device')
  const [routerId, termsId] = await Promise.all([getDeviceMac(), getDeviceMac()])
  expect(routerId).toMatch(/^SK(:[0-9A-F]{2}){5}$/)
  expect(termsId).toBe(routerId)
  expect(localStorage.getItem('skue_device_mac')).toBe(routerId)
  expect(Device.getId).toHaveBeenCalledTimes(1)
  expect(await getDeviceMac()).toBe(routerId)
})
