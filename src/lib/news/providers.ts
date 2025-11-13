import { fetchRedditPosts, type NewsItem as RedditNewsItem } from './reddit'
import getSupabase from '../supabase/client'

export interface NewsItem {
  id: string
  title: string
  summary?: string
  url: string
  image?: string
  date: string
  source: string
}

type Topic = 'crypto' | 'stocks' | 'fx'

const MARKET_AUX_KEY = import.meta.env.VITE_MARKETAUX_KEY as string | undefined
const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY as string | undefined
const NEWSAPI_KEY = import.meta.env.VITE_NEWSAPI_KEY as string | undefined

export type Provider = 'marketaux' | 'finnhub' | 'newsapi' | 'reddit'

export function getProvider(): Provider {
  if (MARKET_AUX_KEY) return 'marketaux'
  if (FINNHUB_KEY) return 'finnhub'
  if (NEWSAPI_KEY) return 'newsapi'
  return 'reddit'
}

function toItems(arr: any[], map: (d: any) => NewsItem | null): NewsItem[] {
  const out: NewsItem[] = []
  for (const d of arr || []) {
    try {
      const it = map(d)
      if (it && it.id && it.title && it.url) out.push(it)
    } catch {}
  }
  return out
}

// MarketAux: https://www.marketaux.com/documentation
async function fetchMarketAux(topic: Topic, page = 1, limit = 10): Promise<{ items: NewsItem[]; nextPage?: number }> {
  const q = topic === 'crypto' ? 'crypto OR bitcoin OR ethereum' : topic === 'fx' ? 'forex OR currency OR usd' : 'stocks OR equities'
  const url = new URL('https://api.marketaux.com/v1/news/all')
  url.searchParams.set('api_token', MARKET_AUX_KEY as string)
  url.searchParams.set('language', 'en')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('page', String(page))
  url.searchParams.set('search', q)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`MarketAux ${res.status}`)
  const j = await res.json()
  const items = toItems(j?.data || [], (d: any) => ({
    id: String(d.uuid || d.id || d.url),
    title: String(d.title || ''),
    summary: d.description ? String(d.description) : undefined,
    url: String(d.url),
    image: d.image_url || undefined,
    date: new Date(d?.published_at || d?.created_at || Date.now()).toLocaleString('ko-KR'),
    source: d?.source || 'MarketAux',
  }))
  const hasMore = Array.isArray(items) && items.length >= limit
  return { items, nextPage: hasMore ? page + 1 : undefined }
}

// Finnhub: https://finnhub.io/docs/api/market-news
async function fetchFinnhub(topic: Topic, minId?: string): Promise<{ items: NewsItem[]; cursor?: string }> {
  const cat = topic === 'crypto' ? 'crypto' : topic === 'fx' ? 'forex' : 'general'
  const url = new URL('https://finnhub.io/api/v1/news')
  url.searchParams.set('category', cat)
  if (minId) url.searchParams.set('minId', minId)
  url.searchParams.set('token', FINNHUB_KEY as string)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Finnhub ${res.status}`)
  const j = await res.json()
  const items = toItems(j || [], (d: any) => ({
    id: String(d.id),
    title: String(d.headline || d.title || ''),
    summary: d.summary ? String(d.summary) : undefined,
    url: String(d.url || ''),
    image: d.image || undefined,
    date: new Date((d.datetime || d.time || Date.now()) * 1000).toLocaleString('ko-KR'),
    source: d.source || 'Finnhub',
  }))
  const cursor = items.length ? String(items[items.length - 1].id) : undefined
  return { items, cursor }
}

// NewsAPI: https://newsapi.org/docs/endpoints/everything
async function fetchNewsAPI(topic: Topic, page = 1, pageSize = 10): Promise<{ items: NewsItem[]; nextPage?: number }> {
  const q = topic === 'crypto' ? 'crypto OR bitcoin OR ethereum' : topic === 'fx' ? 'forex OR currency OR usd' : 'stock market OR equities'
  const url = new URL('https://newsapi.org/v2/everything')
  url.searchParams.set('q', q)
  url.searchParams.set('language', 'en')
  url.searchParams.set('page', String(page))
  url.searchParams.set('pageSize', String(pageSize))
  url.searchParams.set('apiKey', NEWSAPI_KEY as string)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`NewsAPI ${res.status}`)
  const j = await res.json()
  const items = toItems(j?.articles || [], (a: any) => ({
    id: String(a.url),
    title: String(a.title || ''),
    summary: a.description ? String(a.description) : undefined,
    url: String(a.url),
    image: a.urlToImage || undefined,
    date: new Date(a.publishedAt || Date.now()).toLocaleString('ko-KR'),
    source: a?.source?.name || 'NewsAPI',
  }))
  const totalResults = Number(j?.totalResults || 0)
  const maxPage = Math.ceil(totalResults / pageSize)
  return { items, nextPage: page < maxPage ? page + 1 : undefined }
}

// Unified entry per topic with fallback
export async function fetchTopic(topic: Topic, cursorOrPage?: string | number, limit = 10): Promise<{ items: NewsItem[]; cursor?: string; nextPage?: number; provider: Provider }> {
  // Prefer Supabase Edge Function if configured
  const supabase = getSupabase()
  if (supabase) {
    try {
      const payload: Record<string, any> = {}
      if (typeof cursorOrPage === 'string') payload.cursor = cursorOrPage
      if (typeof cursorOrPage === 'number') payload.page = cursorOrPage
      payload.limit = limit
      // Use POST to pass params reliably
      const { data, error } = await supabase.functions.invoke('news-proxy', {
        body: { topic, ...payload },
      })
      if (!error && data?.items) {
        return { items: data.items, cursor: data.cursor, nextPage: data.nextPage, provider: data.provider || 'reddit' }
      }
    } catch {}
  }
  const provider = getProvider()
  try {
    if (provider === 'marketaux') {
      const page = typeof cursorOrPage === 'number' ? cursorOrPage : 1
      const { items, nextPage } = await fetchMarketAux(topic, page, limit)
      return { items, nextPage, provider }
    }
    if (provider === 'finnhub') {
      const cursor = typeof cursorOrPage === 'string' ? cursorOrPage : undefined
      const { items, cursor: next } = await fetchFinnhub(topic, cursor)
      return { items, cursor: next, provider }
    }
    if (provider === 'newsapi') {
      const page = typeof cursorOrPage === 'number' ? cursorOrPage : 1
      const { items, nextPage } = await fetchNewsAPI(topic, page, limit)
      return { items, nextPage, provider }
    }
  } catch (e) {
    // fall through to reddit on error
  }
  // Reddit fallback
  const sub = topic === 'crypto' ? 'CryptoCurrency' : topic === 'fx' ? 'Forex' : 'stocks'
  const { items, after } = await fetchRedditPosts(sub, typeof cursorOrPage === 'string' ? cursorOrPage : undefined, limit)
  return { items: items as RedditNewsItem[], cursor: after, provider: 'reddit' }
}

export async function fetchCrypto(cursorOrPage?: string | number, limit = 10) {
  return fetchTopic('crypto', cursorOrPage, limit)
}
export async function fetchStocks(cursorOrPage?: string | number, limit = 10) {
  return fetchTopic('stocks', cursorOrPage, limit)
}
export async function fetchFx(cursorOrPage?: string | number, limit = 10) {
  return fetchTopic('fx', cursorOrPage, limit)
}
