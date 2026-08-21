const cleanNameCache = new Map<string, string>()
const MAX_CACHE = 200000

/** Strip episode notation and year suffix */
export function cleanName(name: string): string {
  const cached = cleanNameCache.get(name)
  if (cached !== undefined) return cached

  const cleaned = name
    .replace(/\s*[-–]?\s*S\d{1,3}\s*E\d{1,3}.*$/i, '')
    .replace(/\s*\d{1,3}x\d{1,3}.*$/i, '')
    .replace(/\s*-\s*Ep[.:]?\s*\d+.*$/i, '')
    .replace(/\s*\(\d{4}\)\s*$/i, '')
    .replace(/\s+\d{4}$/i, '')
    .trim()

  if (cleanNameCache.size >= MAX_CACHE) {
    cleanNameCache.clear()
  }
  cleanNameCache.set(name, cleaned)
  return cleaned
}
