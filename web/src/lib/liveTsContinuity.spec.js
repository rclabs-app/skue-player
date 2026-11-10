import { describe, expect, it } from 'vitest'
import { LiveTsContinuity } from './liveTsContinuity'

function clock(value, prefix) {
  return [(prefix << 4) | (Math.floor(value / 2 ** 30) & 7) * 2 | 1,
    Math.floor(value / 2 ** 22) & 255, (Math.floor(value / 2 ** 15) & 127) * 2 | 1,
    Math.floor(value / 2 ** 7) & 255, (value & 127) * 2 | 1]
}
function pes(pts, dts, unbounded = false) {
  const stamps = dts === undefined ? clock(pts, 2) : [...clock(pts, 3), ...clock(dts, 1)]
  const payload = new Uint8Array([0, 0, 1, 0xe0, 0, unbounded ? 0 : 3 + stamps.length + 1,
    0x80, dts === undefined ? 0x80 : 0xc0, stamps.length, ...stamps, 42])
  const packet = new Uint8Array(188).fill(255)
  packet.set([0x47, 0x41, 0, 0x30, 183 - payload.length, 0])
  packet.set(payload, 188 - payload.length)
  return packet
}
function join(...chunks) { const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0)); let p = 0; for (const c of chunks) { out.set(c, p); p += c.length } return out }

describe('TS continuity at HTTP boundaries', () => {
  it('uses decode order for B frames, retaining a lower PTS when DTS advances', () => {
    const filter = new LiveTsContinuity()
    const first = pes(4000, 1000), next = pes(3000, 2000)
    expect(filter.push(join(first, next))).toEqual(join(first, next))
    filter.endResponse()
    expect(filter.push(pes(5000, 1500))).toHaveLength(0)
    expect(filter.progress).toBe(2)
  })
  it('accepts the 33-bit timestamp wrap without rewriting media clocks', () => {
    const filter = new LiveTsContinuity()
    filter.push(pes(2 ** 33 - 100))
    filter.endResponse()
    const next = pes(50)
    expect(filter.push(next)).toEqual(next)
    expect(filter.progress).toBe(2)
  })
  it('distinguishes a large backwards clock candidate from ordinary overlap', () => {
    const filter = new LiveTsContinuity()
    filter.push(pes(328 * 90000))
    filter.endResponse()
    expect(filter.push(pes(327 * 90000))).toHaveLength(0)
    expect(filter.backwardClockPes).toBe(0)
    expect(filter.push(pes(90000))).toHaveLength(0)
    expect(filter.backwardClockPes).toBe(1)
    expect(filter.rejectedPes).toBe(2)
  })
  it('does not join a truncated zero-length PES across responses and accepts its replay', () => {
    const filter = new LiveTsContinuity()
    const first = pes(1000, undefined, true), next = pes(2000, undefined, true), third = pes(3000, undefined, true)
    expect(filter.push(join(first, next))).toEqual(first)
    filter.endResponse()
    expect(filter.push(join(first, next, third))).toEqual(next)
    expect(filter.progress).toBe(2)
  })
  it('reassembles arbitrary network chunks and discards an incomplete TS tail at EOF', () => {
    const filter = new LiveTsContinuity(), packet = pes(1000)
    expect(filter.push(packet.subarray(0, 11))).toHaveLength(0)
    expect(filter.push(packet.subarray(11))).toEqual(packet)
    filter.push(packet.subarray(0, 100))
    filter.endResponse()
    const next = pes(2000)
    expect(filter.push(next)).toEqual(next)
  })
})
