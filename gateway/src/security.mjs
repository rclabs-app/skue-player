import { createDecipheriv, randomBytes, createCipheriv } from 'node:crypto'
import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'

export class GatewayError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code }
}
const forbidden = () => new GatewayError(403, 'INVALID_TICKET')
export function decodeKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error('Invalid gateway key configuration')
  const key = Buffer.from(value, 'base64')
  if (key.length !== 32) throw new Error('Invalid gateway key configuration')
  return key
}
const aad = Buffer.from('skue-media-v1')
export function openTicket(token, key, now = Math.floor(Date.now() / 1000)) {
  try {
    if (typeof token !== 'string' || token.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(token)) throw forbidden()
    const bytes = Buffer.from(token, 'base64url')
    if (bytes.length < 30 || bytes.toString('base64url') !== token) throw forbidden()
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12))
    decipher.setAAD(aad)
    decipher.setAuthTag(bytes.subarray(12, 28))
    const data = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString())
    if (data.v !== 1 || !Number.isInteger(data.exp) || !Number.isInteger(data.iat)
      || data.exp <= now || data.iat > now + 30 || data.exp <= data.iat || data.exp - data.iat > 21600
      || !['mp4', 'm4v', 'webm'].includes(data.format) || typeof data.url !== 'string') throw forbidden()
    return data
  } catch { throw forbidden() }
}
// Useful for synthetic integration tests and PHP/Node contract verification.
export function sealTicket(data, key) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(aad)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
}

function number(ip) { return ip.split('.').reduce((n, octet) => (n * 256 + Number(octet)) >>> 0, 0) }
const blocked = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
]
export function isPublicIPv4(ip) {
  if (isIP(ip) !== 4) return false
  const value = number(ip)
  return !blocked.some(([base, bits]) => (value >>> (32 - bits)) === (number(base) >>> (32 - bits)))
}
export async function publicDestination(value, resolve = lookup) {
  let url
  try { url = new URL(value) } catch { throw new GatewayError(422, 'INVALID_SOURCE') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash
    || isIP(url.hostname) === 6 || url.hostname.includes(':')) throw new GatewayError(422, 'INVALID_SOURCE')
  let timer
  try {
    const records = isIP(url.hostname) === 4 ? [{ address: url.hostname }] : await Promise.race([
      resolve(url.hostname, { family: 4, all: true }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new GatewayError(504, 'DNS_TIMEOUT')), 5000) }),
    ])
    if (!records.length || records.some(record => !isPublicIPv4(record.address))) throw new GatewayError(422, 'PRIVATE_SOURCE')
    return { url, address: records[0].address }
  } finally { clearTimeout(timer) }
}
export function validRange(value) {
  if (value === undefined) return true
  const match = /^bytes=(\d*)-(\d*)$/.exec(value)
  if (!match || (!match[1] && !match[2])) return false
  if ([match[1], match[2]].filter(Boolean).some(n => !Number.isSafeInteger(Number(n)))) return false
  if (!match[1]) return Number(match[2]) > 0
  return !match[2] || Number(match[2]) >= Number(match[1])
}
