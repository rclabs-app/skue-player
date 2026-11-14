import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchLegalManifest, getCachedLegalManifest, hasConfirmedAcceptance, submitAcceptance } from './terms'

export const legal = {
  version: 'test-v1', status: 'Minuta para testes', documents: {
    terms: { title: 'Termos', path: '/termos', sections: [{ title: 'Uso', text: 'Fontes próprias.' }] },
    privacy: { title: 'Privacidade', path: '/privacidade', sections: [{ title: 'Dados', text: 'Configuração sincronizada.' }] },
    notice: { title: 'Aviso', path: '/aviso-legal', sections: [{ title: 'Aviso', text: 'Software em testes.' }] },
  },
}
const device = 'SK:AA:BB:CC:DD:EE'
const mockFetch = vi.fn<typeof fetch>()
const ok = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
const confirm = async (_input: RequestInfo | URL, options?: RequestInit) => {
  const payload = JSON.parse(options?.body as string)
  return ok({ ...payload, status: 'accepted', current_version: payload.terms_version, accepted_at: '2026-11-12T19:30:00Z' }, 201)
}
beforeEach(() => { localStorage.clear(); vi.stubGlobal('fetch', mockFetch); mockFetch.mockReset() })
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('versioned acceptance protocol', () => {
  it('uses backend texts and ignores the legacy local version flag', async () => {
    localStorage.setItem('skue_terms_accepted_version', '1.0-draft')
    mockFetch.mockResolvedValue(ok({ legal, terms_version: legal.version }))
    expect(await fetchLegalManifest()).toEqual(legal)
    expect(getCachedLegalManifest()).toEqual(legal)
    expect(hasConfirmedAcceptance(device, 'web', legal.version)).toBe(false)
  })
  it('confirms only a matching server receipt and requires renewed acceptance on a version change', async () => {
    mockFetch.mockImplementation(confirm)
    await submitAcceptance(device, 'web', legal.version)
    expect(hasConfirmedAcceptance(device, 'web', legal.version)).toBe(true)
    expect(hasConfirmedAcceptance(device, 'web', 'test-v2')).toBe(false)
    expect(hasConfirmedAcceptance('SK:11:22:33:44:55', 'web', legal.version)).toBe(false)
    expect(hasConfirmedAcceptance(device, 'android', legal.version)).toBe(false)
  })
  it.each([422, 500, 503])('does not confirm HTTP %i and retries with the same UUID', async status => {
    mockFetch.mockResolvedValueOnce(ok({ message: 'failed' }, status)).mockImplementationOnce(confirm)
    await expect(submitAcceptance(device, 'web', legal.version)).rejects.toThrow()
    expect(hasConfirmedAcceptance(device, 'web', legal.version)).toBe(false)
    await submitAcceptance(device, 'web', legal.version)
    expect(mockFetch.mock.calls[0]?.[1]?.body).toBe(mockFetch.mock.calls[1]?.[1]?.body)
    expect(hasConfirmedAcceptance(device, 'web', legal.version)).toBe(true)
  })
  it('preserves the attempt on network loss without creating an offline confirmation', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('network')).mockImplementationOnce(confirm)
    await expect(submitAcceptance(device, 'android', legal.version)).rejects.toThrow()
    expect(hasConfirmedAcceptance(device, 'android', legal.version)).toBe(false)
    await submitAcceptance(device, 'android', legal.version)
    expect(mockFetch.mock.calls[0]?.[1]?.body).toBe(mockFetch.mock.calls[1]?.[1]?.body)
  })
  it('rejects malformed or mismatched success responses', async () => {
    mockFetch.mockResolvedValue(ok({ status: 'accepted', terms_version: 'different' }))
    await expect(submitAcceptance(device, 'web', legal.version)).rejects.toThrow()
    expect(hasConfirmedAcceptance(device, 'web', legal.version)).toBe(false)
  })
  it('does not replace valid cached documents on an invalid manifest', async () => {
    mockFetch.mockResolvedValueOnce(ok({ legal, terms_version: legal.version }))
    await fetchLegalManifest()
    mockFetch.mockResolvedValueOnce(ok({ legal, terms_version: 'mismatch' }))
    await expect(fetchLegalManifest()).rejects.toThrow()
    expect(getCachedLegalManifest()).toEqual(legal)
  })
  it('rejects missing device identity before sending', async () => {
    await expect(submitAcceptance('', 'web', legal.version)).rejects.toThrow()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
