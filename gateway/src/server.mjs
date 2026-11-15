import http from 'node:http'
import https from 'node:https'
import { pipeline } from 'node:stream'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { decodeKey, GatewayError, openTicket, publicDestination, validRange } from './security.mjs'

const mediaTypes = new Set(['video/mp4', 'video/webm', 'video/x-m4v', 'audio/mp4', 'application/mp4', 'application/octet-stream'])
function validContentRange(value, length) {
  const match = typeof value === 'string' && /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value)
  if (!match) return false
  const [, start, end, total] = match.map((part, i) => i ? BigInt(part) : part)
  return start <= end && end < total && (length === undefined || (/^\d+$/.test(length) && BigInt(length) === end - start + 1n))
}
const defaultRequest = (url, options, callback) => (url.protocol === 'https:' ? https : http).request(url, options, callback)

export async function openSource(value, options, deps = {}, visited = new Set()) {
  if (visited.size >= 5 || visited.has(value)) throw new GatewayError(502, 'REDIRECT_LIMIT')
  visited.add(value)
  const { url, address } = await publicDestination(value, deps.lookup)
  if (options.signal.aborted) throw new GatewayError(499, 'CLIENT_CLOSED')
  const response = await new Promise((resolve, reject) => {
    const request = (deps.request || defaultRequest)(url, {
      method: options.method, signal: options.signal,
      headers: { 'User-Agent': 'Skue-Media-Gateway/1.0', 'Accept-Encoding': 'identity', ...(options.range ? { Range: options.range } : {}) },
      // The validated address is pinned, including for every redirect.
      lookup: (_host, settings, callback) => callback(null, settings?.all ? [{ address, family: 4 }] : address, settings?.all ? undefined : 4),
      rejectUnauthorized: true,
    }, response => { clearTimeout(timer); resolve(response) })
    const timer = setTimeout(() => request.destroy(new GatewayError(504, 'SOURCE_TIMEOUT')), 10000)
    request.setTimeout(15000, () => request.destroy(new GatewayError(504, 'SOURCE_IDLE_TIMEOUT')))
    request.once('error', error => { clearTimeout(timer); reject(error) })
    request.once('close', () => clearTimeout(timer))
    request.end()
  })
  if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
    const location = response.headers.location
    response.destroy()
    if (!location) throw new GatewayError(502, 'INVALID_REDIRECT')
    let next
    try { next = new URL(location, url).href } catch { throw new GatewayError(502, 'INVALID_REDIRECT') }
    return openSource(next, options, deps, visited)
  }
  return response
}

export function createGateway({ key, origins, maxConnections = 32, maxPerTicket = 3, ...deps }) {
  const active = new Map()
  let connections = 0
  return http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store, private')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    const fail = (status, code) => {
      if (response.destroyed || response.headersSent) return response.destroy()
      response.writeHead(status, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ code }))
    }
    const origin = request.headers.origin
    if (origin && !origins.includes(origin)) return fail(403, 'ORIGIN_NOT_ALLOWED')
    if (origin) {
      response.setHeader('Access-Control-Allow-Origin', origin)
      response.setHeader('Vary', 'Origin')
    }
    response.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
    let target
    try { target = new URL(request.url, 'http://gateway.invalid') } catch { return fail(400, 'INVALID_REQUEST') }
    if (target.pathname === '/health' && request.method === 'GET') { response.setHeader('Content-Type', 'application/json'); response.end('{"status":"ok"}'); return }
    if (!/^\/v1\/media\.(mp4|m4v|webm)$/.test(target.pathname)) return fail(404, 'NOT_FOUND')
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', 'Access-Control-Allow-Headers': 'Range, Accept', 'Access-Control-Max-Age': '600' }); response.end(); return
    }
    if (!['GET', 'HEAD'].includes(request.method)) return fail(405, 'METHOD_NOT_ALLOWED')
    if (!validRange(request.headers.range)) return fail(416, 'INVALID_RANGE')
    let ticket
    const encoded = target.searchParams.get('ticket')
    try { ticket = openTicket(encoded, key) } catch { return fail(403, 'INVALID_TICKET') }
    if (!target.pathname.endsWith('.' + ticket.format)) return fail(403, 'INVALID_TICKET')
    const identity = createHash('sha256').update(encoded).digest('hex')
    if (connections >= maxConnections || (active.get(identity) || 0) >= maxPerTicket) return fail(429, 'TOO_MANY_STREAMS')
    connections++; active.set(identity, (active.get(identity) || 0) + 1)
    const controller = new AbortController()
    let released = false, upstream
    const release = () => {
      if (released) return
      released = true; connections--
      const count = (active.get(identity) || 1) - 1
      if (count) active.set(identity, count); else active.delete(identity)
      controller.abort(); upstream?.destroy()
    }
    response.once('close', release)
    try {
      upstream = await openSource(ticket.url, { method: request.method, range: request.headers.range, signal: controller.signal }, deps)
      const status = upstream.statusCode
      if ([401, 403, 451].includes(status)) { upstream.destroy(); return fail(status, 'SOURCE_REFUSED') }
      if (status === 416) {
        const range = upstream.headers['content-range']
        if (typeof range === 'string' && /^bytes \*\/\d+$/.test(range)) response.setHeader('Content-Range', range)
        upstream.destroy(); return fail(416, 'SOURCE_RANGE_NOT_SATISFIABLE')
      }
      if (![200, 206].includes(status)) { upstream.destroy(); return fail(502, 'SOURCE_UNAVAILABLE') }
      const type = (upstream.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
      if (!mediaTypes.has(type)) { upstream.destroy(); return fail(415, 'SOURCE_NOT_MEDIA') }
      if (upstream.headers['content-encoding'] && upstream.headers['content-encoding'] !== 'identity') { upstream.destroy(); return fail(502, 'UNSUPPORTED_ENCODING') }
      const length = upstream.headers['content-length'], range = upstream.headers['content-range']
      if (status === 206 && !validContentRange(range, length)) { upstream.destroy(); return fail(502, 'INVALID_SOURCE_RANGE') }
      response.setHeader('Content-Type', type)
      if (typeof length === 'string' && /^\d+$/.test(length)) response.setHeader('Content-Length', length)
      if (status === 206) response.setHeader('Content-Range', range)
      if (upstream.headers['accept-ranges'] === 'bytes') response.setHeader('Accept-Ranges', 'bytes')
      response.writeHead(status)
      if (request.method === 'HEAD') { upstream.destroy(); response.end(); return }
      // Backpressure bounds memory. Never buffer/cache/persist a movie.
      pipeline(upstream, response, () => { release() })
    } catch (error) {
      fail(error instanceof GatewayError ? error.status : 502, error instanceof GatewayError ? error.code : 'SOURCE_CONNECTION_FAILED')
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const key = decodeKey(process.env.MEDIA_GATEWAY_KEY)
    const origins = (process.env.MEDIA_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
    if (!origins.length || origins.some(value => new URL(value).origin !== value || !value.startsWith('https://'))) throw new Error()
    const server = createGateway({ key, origins })
    server.requestTimeout = 30000
    server.headersTimeout = 15000
    server.listen(Number(process.env.PORT || 8080), '0.0.0.0')
    process.on('SIGTERM', () => { server.close(); setTimeout(() => process.exit(0), 30000).unref() })
  } catch { process.stderr.write('Invalid media gateway configuration.\n'); process.exitCode = 1 }
}
