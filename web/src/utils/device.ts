import { Device } from '@capacitor/device'
import { Preferences } from '@capacitor/preferences'

const STORAGE_KEY = 'rcplayer_device_mac'
let cachedMac = ''

function identifierToMac(id: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < id.length; i++) {
    const c = id.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193)
    h2 = Math.imul(h2 ^ c, 0x811c9dc5)
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0').toUpperCase()
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0').toUpperCase()
  
  return `RC:${hex1.slice(0, 2)}:${hex1.slice(2, 4)}:${hex1.slice(4, 6)}:${hex2.slice(0, 2)}:${hex2.slice(2, 4)}`
}

/**
 * Utility helper to manage device identity and get/generate a persistent MAC address.
 * Uses Native Hardware ID (Android ID) via @capacitor/device when available, 
 * backed by @capacitor/preferences (SharedPreferences) and localStorage.
 */
export async function getDeviceMac(): Promise<string> {
  if (cachedMac) return cachedMac

  // 1. Try Preferences (Native SharedPreferences - survives reinstall if retained)
  try {
    const prefResult = await Preferences.get({ key: STORAGE_KEY })
    if (prefResult && prefResult.value) {
      cachedMac = prefResult.value
      localStorage.setItem(STORAGE_KEY, cachedMac)
      return cachedMac
    }
  } catch (e) {
    // Ignore native preferences error
  }

  // 2. Try localStorage
  const localMac = localStorage.getItem(STORAGE_KEY)
  if (localMac) {
    cachedMac = localMac
    try {
      await Preferences.set({ key: STORAGE_KEY, value: cachedMac })
    } catch {}
    return cachedMac
  }

  // 3. Hardware-based deterministic MAC via Capacitor Device plugin (Android ID / TV UUID)
  try {
    const info = await Device.getId()
    if (info && info.identifier) {
      cachedMac = identifierToMac(info.identifier)
      localStorage.setItem(STORAGE_KEY, cachedMac)
      try {
        await Preferences.set({ key: STORAGE_KEY, value: cachedMac })
      } catch {}
      return cachedMac
    }
  } catch (e) {
    console.warn('[Device] Native Device.getId() not available, falling back to virtual MAC', e)
  }

  // 4. Fallback for pure web browser: generate virtual random MAC
  const chars = '0123456789ABCDEF'
  const parts = ['RC']
  for (let i = 0; i < 5; i++) {
    let part = ''
    part += chars[Math.floor(Math.random() * 16)]
    part += chars[Math.floor(Math.random() * 16)]
    parts.push(part)
  }
  cachedMac = parts.join(':')
  localStorage.setItem(STORAGE_KEY, cachedMac)
  try {
    await Preferences.set({ key: STORAGE_KEY, value: cachedMac })
  } catch {}

  return cachedMac
}

export function getDeviceName(): string {
  const ua = navigator.userAgent
  if (/smart-tv|smarttv|tizen|webos|opera tv|appletv/i.test(ua)) {
    return 'Smart TV'
  }
  if (/ipad|iphone|android/i.test(ua)) {
    return 'Mobile Device'
  }
  return 'Browser Desktop'
}
