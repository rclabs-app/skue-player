import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { openTicket } from '../src/security.mjs'
test('decrypts a ticket issued by the actual PHP MediaTicketService', () => {
  const service = fileURLToPath(new URL('../../backend/app/Services/MediaTicketService.php', import.meta.url))
  const php = `function config($key, $default = null) { return ['media.gateway_url' => 'https://media.example.invalid', 'media.gateway_key' => base64_encode(str_repeat('x',32))][$key] ?? $default; }
function now() { return new class { function getTimestamp() { return time(); } }; }
require $argv[1]; echo json_encode((new App\\Services\\MediaTicketService)->issue('http://source.invalid/movie/synthetic/secret/123.mp4','mp4',42));`
  const issued = JSON.parse(execFileSync('php', ['-r', php, service], { encoding: 'utf8' }))
  const data = openTicket(new URL(issued.url).searchParams.get('ticket'), Buffer.alloc(32, 'x'))
  assert.equal(data.device_id, 42)
  assert.equal(data.url, 'http://source.invalid/movie/synthetic/secret/123.mp4')
  assert.equal(data.exp, issued.expires_at)
})
