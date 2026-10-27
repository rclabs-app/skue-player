/**
 * Helper to build full API URLs.
 * Resolves relative paths like '/api/v1/...' to the configured backend base URL.
 */
export function getApiBaseUrl(): string {
  // 1. Explicit env var (e.g., VITE_API_BASE_URL)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
  }

  // 2. Local storage override (for testing on TV against local PC IP)
  const storedUrl = localStorage.getItem('skue_api_url')
  if (storedUrl) {
    return storedUrl.replace(/\/$/, '')
  }

  // 3. Fallback: relative path (empty string)
  return ''
}

export function getApiUrl(path: string): string {
  const base = getApiBaseUrl()
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${cleanPath}` : cleanPath
}
