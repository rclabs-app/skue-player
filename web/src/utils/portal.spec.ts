import { afterEach, describe, expect, it, vi } from 'vitest'
import { Capacitor } from '@capacitor/core'
import { getContactUrl, getLegalUrl, getPortalUrl } from './portal'

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

  it('links contact to the configured Laravel host without query or fragment', () => {
    vi.stubEnv('VITE_PORTAL_URL', 'https://account.example.invalid/portal?device=synthetic#login')
    expect(getContactUrl()).toBe('https://account.example.invalid/contato')
  })

  it('opens native contact on the public site instead of the WebView origin', () => {
    vi.stubEnv('VITE_PORTAL_URL', '')
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)
    expect(getContactUrl()).toBe('https://skue.tv/contato')
  })

  it('opens development contact on Laravel port 8000', () => {
    vi.stubEnv('VITE_PORTAL_URL', '')
    vi.stubEnv('DEV', true)
    const expected = new URL('/contato', window.location.origin)
    expected.port = '8000'
    expect(getContactUrl()).toBe(expected.toString())
  })
})

 it('links all legal documents to the configured Laravel host', () => {
  vi.stubEnv('VITE_PORTAL_URL', 'https://portal.example.invalid/portal?key=synthetic#login')
  expect(getLegalUrl('terms')).toBe('https://portal.example.invalid/termos')
  expect(getLegalUrl('privacy')).toBe('https://portal.example.invalid/privacidade')
  expect(getLegalUrl('notice')).toBe('https://portal.example.invalid/aviso-legal')
})
