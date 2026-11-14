import { getApiUrl } from './api'

export interface LegalDocument {
  title: string
  path: string
  sections: { title: string; text: string }[]
}
export interface LegalManifest {
  version: string
  status: string
  documents: Record<'terms' | 'privacy' | 'notice', LegalDocument>
}
interface Acceptance {
  acceptance_id: string
  device_id: string
  platform: 'web' | 'android'
  terms_version: string
  accepted_at: string
}
const MANIFEST_KEY = 'skue_legal_manifest'
const RECEIPT_KEY = 'skue_legal_receipt'
const PENDING_KEY = 'skue_legal_pending'

function read(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
function isManifest(value: unknown): value is LegalManifest {
  if (!isRecord(value) || typeof value.version !== 'string' || !value.version || typeof value.status !== 'string' || !isRecord(value.documents)) return false
  return ['terms', 'privacy', 'notice'].every(key => {
    const doc = (value.documents as Record<string, unknown>)[key]
    return isRecord(doc) && typeof doc.title === 'string' && typeof doc.path === 'string'
      && Array.isArray(doc.sections) && doc.sections.length > 0 && doc.sections.every(section =>
        isRecord(section) && typeof section.title === 'string' && typeof section.text === 'string')
  })
}
async function request(path: string, options?: RequestInit): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(getApiUrl(path), { ...options, signal: controller.signal, cache: 'no-store' })
    if (!response.ok) throw new Error('O servidor não confirmou a solicitação.')
    return await response.json()
  } finally { clearTimeout(timer) }
}
export function getCachedLegalManifest(): LegalManifest | null {
  const value = read(MANIFEST_KEY)
  return isManifest(value) ? value : null
}
export async function fetchLegalManifest(): Promise<LegalManifest> {
  const data = await request('/api/v1/app-version')
  if (!isRecord(data) || !isManifest(data.legal) || data.terms_version !== data.legal.version) throw new Error('Documentos indisponíveis.')
  localStorage.setItem(MANIFEST_KEY, JSON.stringify(data.legal))
  return data.legal
}
export function hasConfirmedAcceptance(deviceId: string, platform: string, version: string): boolean {
  const receipt = read(RECEIPT_KEY)
  return isRecord(receipt) && receipt.device_id === deviceId && receipt.platform === platform
    && receipt.terms_version === version && typeof receipt.acceptance_id === 'string'
    && typeof receipt.accepted_at === 'string' && Number.isFinite(Date.parse(receipt.accepted_at))
}
export async function submitAcceptance(deviceId: string, platform: Acceptance['platform'], version: string): Promise<void> {
  if (!/^SK(:[0-9A-F]{2}){5}$/.test(deviceId)) throw new Error('Identificação do dispositivo indisponível.')
  const previous = read(PENDING_KEY)
  const sameAttempt = isRecord(previous) && previous.device_id === deviceId && previous.platform === platform
    && previous.terms_version === version && typeof previous.acceptance_id === 'string'
  const payload = sameAttempt ? previous : {
    acceptance_id: createUuid(), device_id: deviceId, platform, terms_version: version,
  }
  // Persist before sending. A lost response must reuse the exact same identifier.
  localStorage.setItem(PENDING_KEY, JSON.stringify(payload))
  const receipt = await request('/api/v1/terms/accept', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!isRecord(receipt) || receipt.status !== 'accepted' || receipt.acceptance_id !== payload.acceptance_id
    || receipt.device_id !== deviceId || receipt.platform !== platform || receipt.terms_version !== version
    || receipt.current_version !== version || typeof receipt.accepted_at !== 'string'
    || !Number.isFinite(Date.parse(receipt.accepted_at))) throw new Error('O servidor não confirmou o aceite desta versão.')
  localStorage.setItem(RECEIPT_KEY, JSON.stringify(receipt))
  localStorage.removeItem(PENDING_KEY)
}
function createUuid(): string {
  // getRandomValues also supports older TV WebViews without randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6]! & 15) | 64
  bytes[8] = (bytes[8]! & 63) | 128
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
