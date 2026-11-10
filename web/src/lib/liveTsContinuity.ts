const PACKET_SIZE = 188
const CLOCK_WRAP = 2 ** 33
const MAX_PES_BYTES = 4 * 1024 * 1024

interface Pes {
  packets: Uint8Array[]
  payloadBytes: number
  expectedBytes: number
  timestamp: number
}

function timestamp(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! & 14) * 2 ** 29) + bytes[offset + 1]! * 2 ** 22
    + (bytes[offset + 2]! & 254) * 2 ** 14 + bytes[offset + 3]! * 2 ** 7
    + (bytes[offset + 4]! >> 1)
}

/** Keep only complete, advancing PES units. Never join truncated HTTP tails. */
export class LiveTsContinuity {
  private tail = new Uint8Array(0)
  private pending = new Map<number, Pes | null>()
  private last = new Map<number, number>()
  private passthrough = new Set<number>()
  private pendingBytes = 0
  progress = 0
  rejectedPes = 0
  backwardClockPes = 0

  endResponse(): void {
    // A zero-length video PES has no provable end until the next start indicator.
    // Leave its timestamp uncommitted so a replay on the next response can repair it.
    this.pending.clear()
    this.pendingBytes = 0
    this.passthrough.clear()
    this.tail = new Uint8Array(0)
  }

  push(chunk: Uint8Array): Uint8Array {
    const bytes = new Uint8Array(this.tail.length + chunk.length)
    bytes.set(this.tail)
    bytes.set(chunk, this.tail.length)
    const output: Uint8Array[] = []
    const commit = (pid: number, pes: Pes) => {
      output.push(...pes.packets)
      this.pendingBytes -= pes.packets.length * PACKET_SIZE
      this.last.set(pid, pes.timestamp)
      this.progress++
    }
    let offset = 0
    while (offset + PACKET_SIZE <= bytes.length) {
      if (bytes[offset] !== 0x47) { offset++; continue }
      // Check a second sync byte when available to avoid locking onto payload data.
      if (offset + PACKET_SIZE < bytes.length && bytes[offset + PACKET_SIZE] !== 0x47) { offset++; continue }
      const packet = bytes.slice(offset, offset + PACKET_SIZE)
      offset += PACKET_SIZE
      if (packet[1]! & 0x80) continue // transport_error_indicator
      const pid = ((packet[1]! & 31) << 8) | packet[2]!
      const mode = (packet[3]! >> 4) & 3
      if (mode !== 1 && mode !== 3) continue
      const start = 4 + (mode === 3 ? 1 + packet[4]! : 0)
      if (start >= PACKET_SIZE) continue
      const startsPes = !!(packet[1]! & 64) && packet[start] === 0 && packet[start + 1] === 0 && packet[start + 2] === 1
      if (startsPes) {
        this.passthrough.delete(pid)
        const old = this.pending.get(pid)
        if (old && old.expectedBytes === 0) commit(pid, old)
        else if (old) this.pendingBytes -= old.packets.length * PACKET_SIZE
        this.pending.set(pid, null)
        if (this.pending.size > 64) throw new Error('Too many live elementary streams')
        const flags = packet[start + 7]! & 0xc0
        const clockOffset = start + (flags === 0xc0 ? 14 : 9)
        if (!(flags & 0x80)) {
          this.passthrough.add(pid)
          output.push(packet)
          continue
        }
        if (clockOffset + 5 > PACKET_SIZE) {
          throw new Error('Unsupported live PES timestamp header')
        }
        const clock = timestamp(packet, clockOffset)
        const previous = this.last.get(pid)
        const delta = previous === undefined ? 1 : (clock - previous + CLOCK_WRAP * 1.5) % CLOCK_WRAP - CLOCK_WRAP / 2
        if (delta <= 0) {
          this.rejectedPes++
          // A candidate clock reset; do not confuse ordinary overlapping seconds
          // with a large backwards jump or rewrite the source's timestamps.
          if (delta < -30 * 90000) this.backwardClockPes++
          continue
        }
        const length = (packet[start + 4]! << 8) | packet[start + 5]!
        this.pending.set(pid, { packets: [], payloadBytes: 0, expectedBytes: length ? length + 6 : 0, timestamp: clock })
      }
      const pes = this.pending.get(pid)
      if (pes) {
        pes.packets.push(packet)
        this.pendingBytes += PACKET_SIZE
        pes.payloadBytes += PACKET_SIZE - start
        if (pes.packets.length * PACKET_SIZE > MAX_PES_BYTES) throw new Error('Live PES exceeds size limit')
        if (this.pendingBytes > 8 * 1024 * 1024) throw new Error('Live PES buffers exceed size limit')
        if (pes.expectedBytes && pes.payloadBytes >= pes.expectedBytes) {
          commit(pid, pes)
          this.pending.set(pid, null)
        }
      } else if (this.passthrough.has(pid) || (!this.pending.has(pid) && !this.last.has(pid))) {
        // PAT/PMT and other signalling are retained; continuation of known media
        // is ignored until a PES start, including after HTTP reconnect.
        output.push(packet)
      }
    }
    this.tail = bytes.slice(offset)
    const result = new Uint8Array(output.reduce((size, part) => size + part.length, 0))
    let position = 0
    for (const packet of output) { result.set(packet, position); position += packet.length }
    return result
  }
}
