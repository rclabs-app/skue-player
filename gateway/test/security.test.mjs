import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeKey, openTicket, sealTicket, publicDestination, validRange, isPublicIPv4 } from '../src/security.mjs'
const key = Buffer.alloc(32, 1)
const data = { v: 1, iat: 1000, exp: 2000, format: 'mp4', url: 'http://source.invalid/movie/test.mp4' }
test('authenticated encrypted ticket rejects tampering, expiry and excessive lifetime', () => {
  const token = sealTicket(data, key)
  assert.deepEqual(openTicket(token, key, 1001), data)
  for (const candidate of [token.slice(0, -8) + 'AAAAAAAA', '', token + '!']) assert.throws(() => openTicket(candidate, key, 1001))
  assert.throws(() => openTicket(token, key, 2000))
  assert.throws(() => openTicket(sealTicket({ ...data, exp: 999999 }, key), key, 1001))
  assert.throws(() => openTicket(token, Buffer.alloc(32, 2), 1001))
  assert.deepEqual(decodeKey(key.toString('base64')), key)
  assert.throws(() => decodeKey('invalid'))
})
test('DNS and literal addresses reject private, reserved and ambiguous destinations', async () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '100.64.1.1', '192.168.0.1', '0.0.0.0', '224.0.0.1', '198.18.0.1']) assert.equal(isPublicIPv4(ip), false)
  assert.equal(isPublicIPv4('93.184.216.34'), true)
  for (const url of ['http://127.1', 'http://2130706433', 'http://[::1]', 'file:///private', 'http://user:pass@source.invalid', 'http://source.invalid/#fragment']) await assert.rejects(publicDestination(url))
  await assert.rejects(publicDestination('http://source.invalid', async () => [{ address: '93.184.216.34' }, { address: '10.0.0.1' }]))
  assert.equal((await publicDestination('https://source.invalid', async () => [{ address: '93.184.216.34' }])).address, '93.184.216.34')
})
test('single safe byte ranges only', () => {
  for (const value of [undefined, 'bytes=0-99', 'bytes=100-', 'bytes=-100']) assert.equal(validRange(value), true)
  for (const value of ['bytes=-', 'bytes=-0', 'bytes=5-4', 'bytes=0-1,3-4', 'bytes=9007199254740992-', 'items=0-1']) assert.equal(validRange(value), false)
})
