// Test-only: reuse the synthetic fixture on an advancing MPEG-TS timeline.
export function shiftTsClock(source, seconds) {
  const out = new Uint8Array(source)
  for (let i = 0; i + 188 <= out.length; i += 188) {
    if (out[i] !== 0x47 || !(out[i + 1] & 64)) continue
    const mode = (out[i + 3] >> 4) & 3
    if (mode !== 1 && mode !== 3) continue
    const k = i + 4 + (mode === 3 ? 1 + out[i + 4] : 0)
    if (k + 19 > i + 188 || out[k] !== 0 || out[k + 1] !== 0 || out[k + 2] !== 1) continue
    const flags = out[k + 7] & 0xc0
    if (!(flags & 0x80)) continue
    for (const position of flags === 0xc0 ? [k + 9, k + 14] : [k + 9]) {
      const old = ((out[position] & 14) * 2 ** 29) + out[position + 1] * 2 ** 22
        + (out[position + 2] & 254) * 2 ** 14 + out[position + 3] * 2 ** 7 + (out[position + 4] >> 1)
      const value = (old + seconds * 90000) % 2 ** 33
      out[position] = (out[position] & 0xf0) | (Math.floor(value / 2 ** 30) & 7) * 2 | 1
      out[position + 1] = Math.floor(value / 2 ** 22) & 255
      out[position + 2] = (Math.floor(value / 2 ** 15) & 127) * 2 | 1
      out[position + 3] = Math.floor(value / 2 ** 7) & 255
      out[position + 4] = (value & 127) * 2 | 1
    }
  }
  return out
}
