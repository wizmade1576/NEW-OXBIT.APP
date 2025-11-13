import { fetchCrypto, fetchStocks, fetchFx, type NewsItem } from './providers'

export type TopicKey = 'crypto' | 'stocks' | 'fx'

export interface CursorState {
  crypto?: string
  stocks?: string
  fx?: string
}

export interface PageState {
  crypto?: number
  stocks?: number
  fx?: number
}

export interface FetchAllResult {
  items: NewsItem[]
  cursor: CursorState
  page: PageState
}

export async function fetchAllTopics(
  opts: { cursor?: CursorState; page?: PageState; limitPerTopic?: number } = {}
): Promise<FetchAllResult> {
  const limit = opts.limitPerTopic ?? 5
  const cursor = { ...(opts.cursor || {}) }
  const page = { ...(opts.page || {}) }

  const [c, s, f] = await Promise.all([
    fetchCrypto(cursor.crypto ?? (page.crypto || 1), limit),
    fetchStocks(cursor.stocks ?? (page.stocks || 1), limit),
    fetchFx(cursor.fx ?? (page.fx || 1), limit),
  ])

  const merged = [...c.items, ...s.items, ...f.items]
  // dedupe by id or url
  const seen = new Set<string>()
  const items: NewsItem[] = []
  for (const it of merged) {
    const key = (it.id || it.url).toString()
    if (seen.has(key)) continue
    seen.add(key)
    items.push(it)
  }
  // newest first
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // advance cursors/pages
  if (c.cursor) cursor.crypto = c.cursor
  if (s.cursor) cursor.stocks = s.cursor
  if (f.cursor) cursor.fx = f.cursor
  if (c.nextPage) page.crypto = c.nextPage
  if (s.nextPage) page.stocks = s.nextPage
  if (f.nextPage) page.fx = f.nextPage

  return { items, cursor, page }
}

export default fetchAllTopics

