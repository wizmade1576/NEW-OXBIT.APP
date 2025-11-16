// Reddit fallback removed; keep types local
import getSupabase from '../supabase/client'
import { fetchWithTimeout } from '../net/proxy'

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

export type Provider = 'marketaux' | 'finnhub' | 'newsapi' | 'reddit' | 'none'

export function getProvider(): Provider {
  if (MARKET_AUX_KEY) return 'marketaux'
  if (FINNHUB_KEY) return 'finnhub'
  if (NEWSAPI_KEY) return 'newsapi'
  // Remove implicit Reddit fallback: default to 'none'
  return 'none'
}

// In-flight request de-duplication for Edge Function calls
type EdgeKey = string
const inflightEdge = new Map<EdgeKey, Promise<{ items: NewsItem[]; nextPage?: number; nextCursor?: string; provider: Provider }>>()
const edgeKeyOf = (p: { topic: Topic; cursorOrPage?: string | number; limit?: number }) =>
  `t=${p.topic}&cp=${String(p.cursorOrPage ?? '')}&l=${String(p.limit ?? '')}`

// Domain whitelist (Option B): prefer these Korean media sites when available.
const NEWS_DOMAIN_WHITELIST = new Set<string>([
  'blockmedia.co.kr',
  'www.blockmedia.co.kr',
  'm.coinreaders.com',
  'coinreaders.com',
  'www.coinreaders.com',
  'bonmedia.kr',
  'www.bonmedia.kr',
  'theguru.co.kr',
  'www.theguru.co.kr',
  'tokenpost.kr',
  'www.tokenpost.kr',
])

function hostnameFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    const h = new URL(url).hostname.toLowerCase()
    return h.startsWith('www.') ? h.slice(4) : h
  } catch {
    return undefined
  }
}

function applyDomainWhitelist(items: NewsItem[]): NewsItem[] {
  try {
    const filtered = items.filter((it) => {
      const host = hostnameFromUrl(it.url)
      return host ? NEWS_DOMAIN_WHITELIST.has(host) || NEWS_DOMAIN_WHITELIST.has('www.' + host) : false
    })
    // Fallback: if no items match, return original list to avoid empty feeds
    return filtered.length > 0 ? filtered : items
  } catch {
    return items
  }
}

// Normalize news URLs to improve deduplication
export function normalizeNewsUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url)
    // lower-case host and strip www.
    let host = u.hostname.toLowerCase()
    if (host.startsWith('www.')) host = host.slice(4)
    // drop tracking params
    const params = u.searchParams
    const toDelete: string[] = []
    params.forEach((_v, k) => {
      const lk = k.toLowerCase()
      if (lk === 'fbclid' || lk === 'gclid') toDelete.push(k)
      else if (lk.startsWith('utm_')) toDelete.push(k)
      else if (lk === 'ref' || lk === 'source' || lk === 'from') toDelete.push(k)
    })
    toDelete.forEach((k) => params.delete(k))
    // build normalized url without hash
    const path = u.pathname.replace(/\/+$/,'') || '/'
    const qs = params.toString()
    const norm = `${u.protocol}//${host}${path}${qs ? `?${qs}` : ''}`
    return norm
  } catch {
    return url
  }
}

function dedupeAndNormalize(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>()
  const out: NewsItem[] = []
  for (const it of items) {
    const norm = normalizeNewsUrl(it.url) || it.url
    if (seen.has(norm)) continue
    seen.add(norm)
    out.push({ ...it, id: norm, url: norm })
  }
  return out
}

// -------- Client-side curated RSS fallback (when Edge Function unavailable) --------
type CuratedSource = { name: string; url: string }
const CURATED_SOURCES: CuratedSource[] = [
  { name: 'TokenPost', url: 'https://www.tokenpost.kr/rss' },
  { name: 'BlockMedia', url: 'https://www.blockmedia.co.kr/rss' },
  { name: 'CoinReaders', url: 'https://m.coinreaders.com/plugin/rss' },
  { name: 'BonMedia', url: 'https://www.bonmedia.kr/rss' },
  { name: 'TheGuru', url: 'https://www.theguru.co.kr/rss' },
]

function parseDateSafe(s?: string | null): string {
  if (!s) return new Date().toISOString()
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function textOf(el: Element | null, sel: string): string | undefined {
  const n = el?.querySelector(sel)
  const t = n?.textContent?.trim()
  return t || undefined
}

function extractImg(html?: string): string | undefined {
  if (!html) return undefined
  try {
    const m = html.match(/<img[^>]*src=["']([^"']+)["']/i)
    return m?.[1]
  } catch { return undefined }
}

async function fetchRssClient(url: string, name: string): Promise<NewsItem[]> {
  // Try multiple public CORS proxies (order matters), then direct as a last resort.
  const urls = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://cors.isomorphic-git.org/${url}`,
    url,
  ]
  for (const u of urls) {
    try {
      const res = await fetch(u)
      if (!res.ok) continue
      const xml = await res.text()
      const doc = new DOMParser().parseFromString(xml, 'text/xml')
      const items: NewsItem[] = []
      const rssItems = Array.from(doc.querySelectorAll('rss channel item'))
      const atomItems = Array.from(doc.querySelectorAll('feed entry'))
      if (rssItems.length) {
        for (const it of rssItems) {
          const title = textOf(it, 'title') || ''
          const link = textOf(it, 'link') || ''
          const desc = textOf(it, 'description') || textOf(it, 'content\\:encoded')
          const date = textOf(it, 'pubDate') || textOf(it, 'published') || textOf(it, 'updated')
          const media = (it.querySelector('media\\:content')?.getAttribute('url')) || extractImg(desc)
          if (title && link) items.push({ id: link, title, summary: desc, url: link, image: media || undefined, date: parseDateSafe(date), source: name })
        }
      } else if (atomItems.length) {
        for (const it of atomItems) {
          const title = textOf(it, 'title') || ''
          const linkEl = it.querySelector('link')
          const link = (linkEl?.getAttribute('href') || linkEl?.textContent || '').trim()
          const summary = textOf(it, 'summary') || textOf(it, 'content')
          const date = textOf(it, 'updated') || textOf(it, 'published')
          if (title && link) items.push({ id: link, title, summary, url: link, image: extractImg(summary), date: parseDateSafe(date), source: name })
        }
      }
      if (items.length) return items
    } catch {
      // try next proxy
    }
  }
  return []
}

async function fetchCuratedClient(topic: 'crypto' | 'stocks' | 'fx', limit = 20): Promise<NewsItem[]> {
  const results = await Promise.all(CURATED_SOURCES.map((s) => fetchRssClient(s.url, s.name)))
  let items = results.flat()
  const kwCrypto = /bitcoin|btc|crypto|ethereum|eth|코인|암호|블록체인|가상화폐/i
  const kwFx = /forex|fx|환율|금리|달러|usd|eur|jpy|환전/i
  const kwStocks = /stocks|주식|증시|나스닥|s&p|kospi|코스피|코스닥|기업/i
  let filtered = items.filter((n) => {
    const t = (n.title + ' ' + (n.summary || '')).toLowerCase()
    if (topic === 'crypto') return kwCrypto.test(t)
    if (topic === 'fx') return kwFx.test(t)
    return kwStocks.test(t) || (!kwCrypto.test(t) && !kwFx.test(t))
  })
  // If nothing matched (e.g., source formats change), fallback to unfiltered items
  if (filtered.length === 0) filtered = items
  const out = dedupeAndNormalize(filtered)
  out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return out.slice(0, limit)
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
  // Prefer Supabase Edge Function only when explicitly enabled
  const supabase = getSupabase()
  const useEdge = (import.meta.env.VITE_USE_EDGE_FUNCTIONS as string | undefined) === 'true'
  if (supabase && useEdge) {
    const key = edgeKeyOf({ topic, cursorOrPage, limit })
    const run = async () => {
      try {
        const payload: Record<string, any> = {}
        if (typeof cursorOrPage === 'string') payload.cursor = cursorOrPage
        if (typeof cursorOrPage === 'number') payload.page = cursorOrPage
        payload.limit = limit
        // Allow more time for cold start + upstream fetches
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 10000)
        const { data, error } = await supabase.functions.invoke('news-proxy', {
          body: { topic, ...payload },
          signal: controller.signal as any,
        })
        clearTimeout(timer)
        if (!error && data?.items) {
          return { items: data.items, cursor: (data as any).nextCursor, nextPage: data.nextPage, provider: (data as any).provider || 'reddit' }
        }
      } catch {
        // Try direct GET to the Edge Function before falling back to client-side proxies
        try {
          const base = import.meta.env.VITE_SUPABASE_URL as string | undefined
          const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
          if (base) {
            const url = new URL(`${base}/functions/v1/news-proxy`)
            url.searchParams.set('topic', topic)
            if (typeof cursorOrPage === 'string') url.searchParams.set('cursor', cursorOrPage)
            if (typeof cursorOrPage === 'number') url.searchParams.set('page', String(cursorOrPage))
            url.searchParams.set('limit', String(limit))
            const headers: Record<string, string> = {}
            if (anon) { headers['apikey'] = anon; headers['Authorization'] = `Bearer ${anon}` }
            const r = await fetchWithTimeout(url.toString(), 10000, { headers })
            if (r.ok) {
              const data = await r.json()
              if (data?.items) return { items: data.items, cursor: (data as any).nextCursor, nextPage: data.nextPage, provider: (data as any).provider || 'none' }
            }
          }
        } catch {
          // fallthrough to direct providers
        }
      }
      return { items: [], provider: 'none' as Provider }
    }
    if (inflightEdge.has(key)) return await inflightEdge.get(key)!
    const p = run().finally(() => inflightEdge.delete(key))
    inflightEdge.set(key, p)
    return await p
  }
  // Edge Functions enabled but call failed: avoid browser-side RSS fallback (causes CORS/403)
  // Show graceful empty state instead; logs can be checked on the function side.
  if (useEdge) {
    return { items: [], provider: 'none' }
  }
  const provider = getProvider()
  try {
    if (provider === 'none') {
      // Try client-side curated RSS fallback
      const items = await fetchCuratedClient(topic, limit)
      return { items, provider }
    }
    if (provider === 'marketaux') {
      const page = typeof cursorOrPage === 'number' ? cursorOrPage : 1
      const { items, nextPage } = await fetchMarketAux(topic, page, limit)
      return { items: dedupeAndNormalize(applyDomainWhitelist(items)), nextPage, provider }
    }
    if (provider === 'finnhub') {
      const cursor = typeof cursorOrPage === 'string' ? cursorOrPage : undefined
      const { items, cursor: next } = await fetchFinnhub(topic, cursor)
      return { items: dedupeAndNormalize(applyDomainWhitelist(items)), cursor: next, provider }
    }
    if (provider === 'newsapi') {
      const page = typeof cursorOrPage === 'number' ? cursorOrPage : 1
      const { items, nextPage } = await fetchNewsAPI(topic, page, limit)
      return { items: dedupeAndNormalize(applyDomainWhitelist(items)), nextPage, provider }
    }
  } catch (e) {
    // As a last resort, try curated client-side RSS
    try {
      const items = await fetchCuratedClient(topic, limit)
      return { items, provider }
    } catch {
      return { items: [], provider }
    }
  }
  // Should not reach here
  return { items: [], provider }
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
