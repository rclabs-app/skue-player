/** Stable across playlist ordering; URL keeps different sources isolated. */
export function contentId(url: string, name: string): string {
  const value = JSON.stringify([url, name])
  let a = 2166136261
  let b = 5381
  for (let i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 16777619)
    b = Math.imul(b, 33) ^ value.charCodeAt(i)
  }
  return `vod2-${(a >>> 0).toString(36)}-${(b >>> 0).toString(36)}`
}
