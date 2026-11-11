import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlaylistStore } from './playlist'
import { db } from '../lib/database'

const mock = vi.hoisted(() => ({ config: new Map<string, unknown>(), terminate: vi.fn() }))
vi.mock('../utils/device', () => ({ getDeviceMac: vi.fn(async () => 'SK:AA:BB:CC:DD:EE'), getDeviceName: () => 'Test' }))
vi.mock('../services/epg.service', () => ({ EPGService: { syncEPG: vi.fn() } }))
vi.mock('../workers/m3u-parser.worker?worker', () => ({ default: class {
  terminate = mock.terminate
  postMessage = vi.fn()
} }))
vi.mock('../lib/database', () => ({ db: {
  getPlaylistUserData: vi.fn(async () => ({})),
  getConfig: vi.fn(async (key: string) => mock.config.get(key)),
  saveConfig: vi.fn(async (key: string, value: unknown) => { mock.config.set(key, value) }),
  clearDeviceContent: vi.fn(async () => {
    for (const key of ['playlist_loaded', 'playlist_url', 'epg_url']) mock.config.delete(key)
    mock.config.set('device_removed', true)
  }),
  getSeriesIndex: vi.fn(async () => []), getPlaylistItems: vi.fn(async () => []), saveSeriesIndex: vi.fn(),
} }))
const removed = () => new Response(JSON.stringify({ code: 'DEVICE_REMOVED' }), { status: 410 })

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mock.config.clear()
  mock.config.set('playlist_loaded', true)
  mock.config.set('device_token', 'synthetic-existing-token')
})

describe('administrative device removal', () => {
  it('clears cached data on startup and keeps identity for further requests', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => removed()))
    const store = usePlaylistStore()
    await store.initialize()
    expect(store.deviceRemoved).toBe(true)
    expect(store.isLoaded).toBe(false)
    expect(db.clearDeviceContent).toHaveBeenCalled()
    expect(db.getSeriesIndex).not.toHaveBeenCalled()
    expect(mock.config.get('playlist_loaded')).toBeUndefined()
    expect(mock.config.get('device_token')).toBe('synthetic-existing-token')
    expect(vi.mocked(fetch).mock.calls[0][1]!.headers).toMatchObject({ Authorization: 'Bearer synthetic-existing-token' })
  })
  it('clears state on config sync and prevents a new import', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => removed()))
    const store = usePlaylistStore()
    store.isLoaded = true
    store.devicePlaylists = [{ id: 1, name: 'Old', is_active: true, is_main: true }]
    await store.fetchDeviceConfig()
    expect(store.isLoaded).toBe(false)
    expect(store.devicePlaylists).toEqual([])
    await expect(store.loadPlaylistFromUrl('https://example.com/test')).rejects.toThrow('removido')
  })
  it.each(['offline', 'unauthorized', 'unrelated-410'])('preserves cached content on ordinary %s failures', async (reason) => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (reason === 'offline') throw new TypeError('Network unavailable')
      return new Response('{}', { status: reason === 'unauthorized' ? 401 : 410 })
    }))
    const store = usePlaylistStore()
    await store.initialize()
    expect(store.isLoaded).toBe(true)
    expect(store.deviceRemoved).toBe(false)
    expect(db.clearDeviceContent).not.toHaveBeenCalled()
  })
  it('keeps a previously removed installation empty while offline', async () => {
    mock.config.set('device_removed', true)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Network unavailable') }))
    const store = usePlaylistStore()
    await store.initialize()
    expect(store.isLoaded).toBe(false)
    expect(db.clearDeviceContent).toHaveBeenCalled()
  })
  it('permits an explicit admin registration to reactivate the identity', async () => {
    mock.config.set('device_removed', true)
    mock.config.delete('playlist_loaded')
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('{"device_key":"ABC234","playlists_count":0,"device_token":"new-test-token"}'))
      .mockResolvedValueOnce(new Response('{"playlists":[]}')))
    const store = usePlaylistStore()
    await store.initialize()
    expect(store.deviceRemoved).toBe(false)
    expect(mock.config.get('device_removed')).toBe(false)
    expect(store.isLoaded).toBe(false)
  })
  it('cancels an active import on an explicit removal response', async () => {
    const store = usePlaylistStore()
    const importing = store.streamToWorker(new Response('test playlist'), 'https://example.com/test').catch(error => error)
    vi.stubGlobal('fetch', vi.fn(async () => removed()))
    await expect(store.syncHandshake()).rejects.toThrow('removido')
    expect(await importing).toBeInstanceOf(Error)
    expect(mock.terminate).toHaveBeenCalled()
    expect(store.isLoaded).toBe(false)
  })
  it('clears the old cache before accepting a new key and does not wipe the new access on later sync', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{"reset_required":true,"device_key":"NEW234","playlists_count":0,"device_token":"new-test-token"}'))
      .mockResolvedValueOnce(new Response('{"playlists":[]}'))
      .mockResolvedValueOnce(new Response('{"reset_required":false,"device_key":"NEW234","playlists_count":0,"device_token":"new-test-token"}'))
    vi.stubGlobal('fetch', fetchMock)
    const store = usePlaylistStore()
    await store.initialize()
    expect(db.clearDeviceContent).toHaveBeenCalledTimes(1)
    expect(store.deviceRemoved).toBe(false)
    expect(store.isLoaded).toBe(false)
    expect(mock.config.get('device_token')).toBe('new-test-token')
    mock.config.set('playlist_loaded', true)
    const next = await store.syncHandshake()
    expect(next.device_key).toBe('NEW234')
    expect(next.reset_required).toBe(false)
    expect(db.clearDeviceContent).toHaveBeenCalledTimes(1)
    expect(mock.config.get('playlist_loaded')).toBe(true)
  })

  it('waits with a stable pending key and fetches configuration only after portal confirmation', async () => {
    const pending = { registration_pending: true, device_key: 'NEW234', device_token: null, playlists_count: 0 }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...pending, reset_required: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify(pending)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...pending, registration_pending: false, device_token: 'confirmed-token' })))
      .mockResolvedValueOnce(new Response('{"playlists":[]}'))
    vi.stubGlobal('fetch', fetchMock)
    const store = usePlaylistStore()
    await store.initialize()
    expect(store.registrationPending).toBe(true)
    expect(store.isLoaded).toBe(false)
    expect(mock.config.get('device_token')).toBeNull()
    expect(mock.config.get('pending_device_key')).toBe('NEW234')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(await store.fetchDeviceConfig()).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string).registration_key).toBe('NEW234')
    expect(db.clearDeviceContent).toHaveBeenCalledTimes(1)
    await store.fetchDeviceConfig()
    expect(store.registrationPending).toBe(false)
    expect(mock.config.get('pending_device_key')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls[3]![1]!.headers).toMatchObject({ Authorization: 'Bearer confirmed-token' })
  })

  it('keeps a pending installation unloaded when reopened offline', async () => {
    mock.config.set('pending_device_key', 'NEW234')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Network unavailable') }))
    const store = usePlaylistStore()
    await store.initialize()
    expect(store.registrationPending).toBe(true)
    expect(store.isLoaded).toBe(false)
    expect(db.getSeriesIndex).not.toHaveBeenCalled()
  })

})
