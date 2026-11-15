import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { createGateway } from '../src/server.mjs'
import { sealTicket } from '../src/security.mjs'
const key = Buffer.alloc(32, 2)
const bytes = Buffer.alloc(2 * 1024 * 1024 + 13, 42)
async function fixture(t, options = {}) {
  let calls = 0, cancelled = false
  const source = http.createServer((req, res) => {
    calls++
    const path = new URL(req.url, 'http://source.invalid').pathname
    if (path.startsWith('/refuse/')) { res.writeHead(Number(path.split('/')[2])); res.end('private upstream detail'); return }
    if (path === '/private') { res.writeHead(302, { Location: 'http://127.0.0.1/private' }); res.end(); return }
    if (path === '/loop') { res.writeHead(302, { Location: '/loop' }); res.end(); return }
    if (path === '/bad-range') { res.writeHead(206, { 'Content-Type': 'video/mp4', 'Content-Range': 'bytes 10-1/20' }); res.end('bad'); return }
    if (path === '/compressed') { res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Encoding': 'gzip' }); res.end('bad'); return }
    if (path === '/html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('not media'); return }
    if (path === '/slow') {
      res.writeHead(200, { 'Content-Type': 'video/mp4' }); res.write(bytes.subarray(0, 128))
      const timer = setInterval(() => res.write(bytes.subarray(0, 128)), 20)
      res.once('close', () => { cancelled = true; clearInterval(timer) }); return
    }
    let start = 0, end = bytes.length - 1, status = 200
    if (req.headers.range) {
      const [, a, b] = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range)
      start = a ? Number(a) : bytes.length - Number(b)
      end = a && b ? Number(b) : end
      if (start >= bytes.length) { res.writeHead(416, { 'Content-Range': `bytes */${bytes.length}` }); res.end(); return }
      status = 206
    }
    res.writeHead(status, { 'Content-Type': 'video/mp4', 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${bytes.length}` } : {}) })
    res.end(req.method === 'HEAD' ? undefined : bytes.subarray(start, end + 1))
  })
  source.listen(0, '127.0.0.1'); await once(source, 'listening')
  const gateway = createGateway({ key, origins: ['https://player.example.invalid'], ...options,
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    request: (url, settings, cb) => {
      assert.equal(settings.rejectUnauthorized, true)
      settings.lookup(url.hostname, {}, (error, address) => { assert.equal(error, null); assert.equal(address, '93.184.216.34') })
      // Test-only transport maps a validated public hostname to this synthetic server.
      return http.request({ ...settings, hostname: '127.0.0.1', port: source.address().port, path: url.pathname }, cb)
    },
  })
  gateway.listen(0, '127.0.0.1'); await once(gateway, 'listening')
  t.after(() => { gateway.closeAllConnections(); source.closeAllConnections(); gateway.close(); source.close() })
  const url = (path = '/movie') => {
    const now = Math.floor(Date.now() / 1000)
    const ticket = sealTicket({ v: 1, iat: now, exp: now + 3600, format: 'mp4', url: 'http://source.invalid' + path }, key)
    return `http://127.0.0.1:${gateway.address().port}/v1/media.mp4?ticket=${ticket}`
  }
  return { url, calls: () => calls, cancelled: () => cancelled }
}
test('streaming, seeking, suffix ranges and HEAD preserve bytes and headers', async t => {
  const f = await fixture(t), url = f.url()
  const full = await fetch(url, { headers: { Origin: 'https://player.example.invalid' } })
  assert.equal(full.status, 200); assert.equal(full.headers.get('access-control-allow-origin'), 'https://player.example.invalid')
  assert.equal(full.headers.get('cache-control'), 'no-store, private')
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), bytes)
  for (const [range, start, end] of [['bytes=100-199', 100, 200], ['bytes=-17', bytes.length - 17, bytes.length], ['bytes=2097152-', 2097152, bytes.length]]) {
    const response = await fetch(url, { headers: { Range: range } })
    assert.equal(response.status, 206)
    assert.equal(response.headers.get('content-range'), `bytes ${start}-${end - 1}/${bytes.length}`)
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(start, end))
  }
  const head = await fetch(url, { method: 'HEAD' }); assert.equal(head.status, 200)
  assert.equal(head.headers.get('content-length'), String(bytes.length)); assert.equal((await head.arrayBuffer()).byteLength, 0)
  const out = await fetch(url, { headers: { Range: 'bytes=999999999-' } }); assert.equal(out.status, 416)
})
test('refusals and unsafe redirects stop without fetching alternatives or exposing source body', async t => {
  const f = await fixture(t)
  for (const status of [401, 403, 451]) {
    const before = f.calls(), response = await fetch(f.url('/refuse/' + status))
    assert.equal(response.status, status); assert.deepEqual(await response.json(), { code: 'SOURCE_REFUSED' }); assert.equal(f.calls(), before + 1)
  }
  for (const [path, status] of [['/private', 422], ['/loop', 502], ['/html', 415], ['/bad-range', 502], ['/compressed', 502]]) {
    const before = f.calls(), response = await fetch(f.url(path)); assert.equal(response.status, status); assert.equal(f.calls(), before + 1)
  }
  const before = f.calls()
  assert.equal((await fetch(f.url(), { headers: { Origin: 'https://untrusted.invalid' } })).status, 403)
  assert.equal((await fetch(f.url() + 'broken')).status, 403)
  assert.equal((await fetch(f.url(), { headers: { Range: 'bytes=0-1,4-5' } })).status, 416)
  assert.equal(f.calls(), before)
})
test('client cancellation releases the upstream and concurrency slot', async t => {
  const f = await fixture(t, { maxConnections: 1 }), url = f.url('/slow'), controller = new AbortController()
  const response = await fetch(url, { signal: controller.signal })
  const reader = response.body.getReader(); assert.equal((await reader.read()).value.length, 128)
  assert.equal((await fetch(url)).status, 429)
  controller.abort(); await reader.cancel().catch(() => {})
  for (let count = 0; count < 50 && !f.cancelled(); count++) await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(f.cancelled(), true)
  assert.equal((await fetch(f.url(), { method: 'HEAD' })).status, 200)
})
