import { Capacitor } from '@capacitor/core'

/** Link directly to Laravel; the player never serves the customer portal. */
export function getPortalUrl(): string {
  const configured = import.meta.env.VITE_PORTAL_URL
  if (configured) return new URL(configured, window.location.origin).toString()
  if (Capacitor.isNativePlatform()) return 'https://skue.tv/portal'
  const url = new URL('/portal', window.location.origin)
  if (import.meta.env.DEV) url.port = '8000'
  return url.toString()
}
