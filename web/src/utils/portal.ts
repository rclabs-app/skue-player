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

/** Contact is served by the same Laravel installation as the customer portal. */
export function getContactUrl(): string {
  return new URL('/contato', getPortalUrl()).toString()
}

/** Legal documents share the Laravel origin, including native installations. */
export function getLegalUrl(document: 'terms' | 'privacy' | 'notice'): string {
  const paths = { terms: '/termos', privacy: '/privacidade', notice: '/aviso-legal' }
  return new URL(paths[document], getPortalUrl()).toString()
}
