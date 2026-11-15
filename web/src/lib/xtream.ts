import type { PlaylistConfig } from '../utils/playlist'
import type { PlaylistItem } from '../types/m3u'
import { contentId } from './contentIdentity'

type Row = Record<string, unknown>
const text = (value: unknown): string => typeof value === 'string' || typeof value === 'number' ? String(value) : ''
const safe = (value: unknown): string => text(value).replace(/[\r\n"\u0000]/g, ' ').trim()
const id = (value: unknown): string => /^\d+$/.test(text(value)) ? text(value) : ''
const extension = (value: unknown): string => /^[a-zA-Z0-9]{1,8}$/.test(text(value)) ? text(value) : 'mp4'
const row = (value: unknown): Row => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}

export class XtreamError extends Error {
  constructor(message: string, readonly status?: number) { super(message); this.name = 'XtreamError' }
}

/** Generic direct API client: never changes host/scheme or falls back after refusal. */
export class XtreamClient {
  readonly base: URL
  readonly seriesPrefix: string
  private liveExtension = 'ts'
  constructor(readonly config: PlaylistConfig, private signal?: AbortSignal, private onStatus?: (status: number) => void) {
    try {
      this.base = new URL(config.url.replace(/\/+$/, '') + '/')
      if (!['http:', 'https:'].includes(this.base.protocol) || this.base.username || this.base.password || this.base.search || this.base.hash
        || !config.username || !config.password) throw new Error()
    } catch { throw new XtreamError('Confira o servidor, usuário e senha da conta Xtream.') }
    this.seriesPrefix = `xc:${contentId(this.base.href, config.username!)}:`
  }

  private media(kind: 'live' | 'movie' | 'series', itemId: string, ext = ''): string {
    return new URL(`${kind}/${encodeURIComponent(this.config.username!)}/${encodeURIComponent(this.config.password!)}/${itemId}${ext ? '.' + ext : ''}`, this.base).href
  }

  async request(action?: string, extra: Record<string, string> = {}): Promise<unknown> {
    const url = new URL('player_api.php', this.base)
    url.search = new URLSearchParams({ username: this.config.username!, password: this.config.password!, ...(action ? { action } : {}), ...extra }).toString()
    const controller = new AbortController()
    const abort = () => controller.abort()
    this.signal?.addEventListener('abort', abort, { once: true })
    if (this.signal?.aborted) controller.abort()
    const timer = setTimeout(abort, 45000)
    try {
      const response = await fetch(url.href, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' })
      this.onStatus?.(response.status)
      if (!response.ok) {
        await response.body?.cancel().catch(() => {})
        throw new XtreamError(response.status === 451
          ? 'A API da fonte recusou o acesso (HTTP 451). Verifique as condições de acesso com o responsável pela fonte.'
          : `A API Xtream respondeu HTTP ${response.status}.`, response.status)
      }
      try { return await response.json() }
      catch { throw new XtreamError('A fonte não retornou uma resposta Xtream válida.') }
    } catch (error) {
      if (error instanceof XtreamError) throw error
      throw new XtreamError(controller.signal.aborted
        ? 'A consulta Xtream foi cancelada ou excedeu o tempo limite.'
        : 'Não foi possível acessar a API Xtream diretamente. Confira HTTPS e a permissão CORS da fonte.')
    } finally {
      clearTimeout(timer)
      this.signal?.removeEventListener('abort', abort)
    }
  }

  private async list(action: string): Promise<Row[]> {
    const data = await this.request(action)
    // Some sources represent an empty category/catalog as {}.
    if (Array.isArray(data)) {
      if (!data.every(item => item !== null && typeof item === 'object' && !Array.isArray(item))) throw new XtreamError('Formato de catálogo Xtream inválido.')
      return data as Row[]
    }
    if (data && typeof data === 'object' && Object.keys(data).length === 0) return []
    throw new XtreamError('A fonte não retornou um catálogo Xtream válido.')
  }

  async playlistResponse(): Promise<Response> {
    const auth = row(await this.request())
    const user = row(auth.user_info)
    if (text(user.auth) !== '1' || (user.status && user.status !== 'Active')) throw new XtreamError('A conta Xtream está inválida, expirada ou sem acesso.')
    if (Array.isArray(user.allowed_output_formats) && user.allowed_output_formats.includes('m3u8')) this.liveExtension = 'm3u8'
    const iterator = this.lines()
    const encoder = new TextEncoder()
    return new Response(new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const next = await iterator.next()
          if (next.done) controller.close()
          else controller.enqueue(encoder.encode(next.value))
        } catch (error) { controller.error(error) }
      },
      async cancel() { await iterator.return(undefined) },
    }), { headers: { 'Content-Type': 'audio/x-mpegurl' } })
  }

  private async *lines(): AsyncGenerator<string> {
    yield '#EXTM3U\n'
    let total = 0
    for (const [kind, categoryAction, itemAction, fallback] of [
      ['live', 'get_live_categories', 'get_live_streams', 'Ao vivo'],
      ['movie', 'get_vod_categories', 'get_vod_streams', 'Filmes'],
      ['series', 'get_series_categories', 'get_series', 'Séries'],
    ] as const) {
      const categories = new Map((await this.list(categoryAction)).map(c => [text(c.category_id), safe(c.category_name)]))
      const items = await this.list(itemAction)
      let chunk = ''
      for (const item of items) {
        const itemId = id(kind === 'series' ? item.series_id : item.stream_id)
        if (!itemId || !safe(item.name)) continue
        const group = categories.get(text(item.category_id)) || fallback
        const logo = safe(kind === 'series' ? item.cover : item.stream_icon)
        const series = kind === 'series' ? ` skue-series-key="${this.seriesPrefix}${itemId}"` : ''
        const url = this.media(kind, itemId, kind === 'live' ? this.liveExtension : kind === 'movie' ? extension(item.container_extension) : '')
        chunk += `#EXTINF:-1 group-title="${group}" tvg-logo="${logo}"${series},${safe(item.name)}\n${url}\n`
        total++
        if (chunk.length >= 65536) { yield chunk; chunk = '' }
      }
      if (chunk) yield chunk
    }
    if (!total) throw new XtreamError('A conta não retornou itens de mídia. O catálogo anterior foi preservado.')
  }

  async episodes(serieKey: string, title: string, group: string, metadata?: (seriesId: string) => Promise<unknown>): Promise<PlaylistItem[]> {
    if (!serieKey.startsWith(this.seriesPrefix)) throw new XtreamError('Esta série pertence a outra configuração Xtream.')
    const seriesId = id(serieKey.slice(this.seriesPrefix.length))
    if (!seriesId) throw new XtreamError('Identificador de série inválido.')
    const data = row(await (metadata ? metadata(seriesId) : this.request('get_series_info', { series_id: seriesId })))
    if (!data.episodes || typeof data.episodes !== 'object') throw new XtreamError('A fonte não retornou os episódios da série.')
    const result: PlaylistItem[] = []
    for (const [season, values] of Object.entries(data.episodes)) {
      if (!Array.isArray(values)) throw new XtreamError('Formato de episódios Xtream inválido.')
      for (const value of values) {
        const episode = row(value)
        const episodeId = id(episode.id)
        if (!episodeId) continue
        const seasonNumber = id(episode.season) || id(season) || '1'
        const episodeNumber = id(episode.episode_num) || String(result.length + 1)
        const name = `${title} S${seasonNumber.padStart(2, '0')}E${episodeNumber.padStart(2, '0')}`
        const url = this.media('series', episodeId, extension(episode.container_extension))
        result.push({ id: contentId(url, name), name, url, group, type: 'series', serieKey, logo: text(row(episode.info).movie_image) || undefined })
      }
    }
    return result
  }
}
