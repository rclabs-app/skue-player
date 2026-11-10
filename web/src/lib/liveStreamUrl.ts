/** Candidate on the same origin, only for the conventional Xtream live URL shapes. */
export function getLiveHlsAlternative(value: string): string | null {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    const match = url.pathname.match(/^\/(?:live\/)?([^/]+)\/([^/]+)\/(\d+)(?:\.ts)?\/?$/i)
    if (!match) return null
    url.pathname = `/live/${match[1]}/${match[2]}/${match[3]}.m3u8`
    return url.href
  } catch {
    return null
  }
}

/** Validate an inferred endpoint before replacing a working/buffered TS player. */
export async function probeLiveHlsManifest(url: string, signal: AbortSignal): Promise<{ supported: boolean; status?: number }> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) controller.abort()
  const timer = setTimeout(abort, 4000)
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    if (!response.ok) {
      await response.body?.cancel().catch(() => {})
      return { supported: false, status: response.status }
    }
    const text = await response.text()
    return { supported: /^\uFEFF?\s*#EXTM3U(?:\s|$)/.test(text), status: response.status }
  } catch {
    return { supported: false }
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
    controller.abort()
  }
}
