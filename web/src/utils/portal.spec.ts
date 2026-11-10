import { afterEach, describe, expect, it, vi } from 'vitest'
import { Capacitor } from '@capacitor/core'
import { getPortalUrl } from './portal'

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn(() => false) } }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false)
})

describe('Laravel portal URL', () => {
  it('uses the configured portal for native QR codes', () => {
    vi.stubEnv('VITE_PORTAL_URL', 'http://192.0.2.1:8000/portal')
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)
    expect(getPortalUrl()).toBe('http://192.0.2.1:8000/portal')
  })

  it('links development QR codes directly to Laravel on the current host', () => {
    vi.stubEnv('VITE_PORTAL_URL', '')
    vi.stubEnv('DEV', true)
    const expected = new URL('/portal', window.location.origin)
    expected.port = '8000'
    expect(getPortalUrl()).toBe(expected.toString())
  })

  it('preserves the public web origin in production', () => {
    vi.stubEnv('VITE_PORTAL_URL', '')
    vi.stubEnv('DEV', false)
    expect(getPortalUrl()).toBe(`${window.location.origin}/portal`)
  })

  it('does not point native QR codes to the internal WebView host', () => {
    vi.stubEnv('VITE_PORTAL_URL', '')
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)
    expect(getPortalUrl()).toBe('https://skue.tv/portal')
  })
})
