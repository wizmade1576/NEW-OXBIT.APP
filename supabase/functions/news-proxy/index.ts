// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: news-proxy
// GET /news-proxy?topic=crypto|stocks|fx&sort=latest|hot&q=...&cursor=...&page=...

type Topic = 'crypto' | 'stocks' | 'fx' | 'all'

type Provider = 'marketaux' | 'finnhub' | 'newsapi' | 'reddit' | 'none'

interface NewsItem {
  id: string
  title: string
  summary?: string
  url: string
  image?: string
  date: string
  source: string
}

function withCorsHeaders(headers: HeadersInit = {}) {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'max-age=60',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    ...headers,
  }
}

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: withCorsHeaders(init.headers),
  })
}

// ---------------- In-memory cache (10s TTL) with simple SWR ----------------
const CACHE_TTL_MS = 10_000
const cache = new Map<string, { ts: number; data: any }>()
function cacheKey(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([, v]) => typeof v !== 'undefined')
    .map(([k, v]) => `${k}=${String(v ?? '')}`)
    .sort()
    .join('&')
}

function pickProvider(): Provider {
  const hasMarketAux = !!Deno.env.get('MARKETAUX_KEY')
  const hasFinnhub = !!Deno.env.get('FINNHUB_KEY')
  const hasNewsAPI = !!Deno.env.get('NEWSAPI_KEY')
  if (hasMarketAux) return 'marketaux'
  if (hasFinnhub) return 'finnhub'
  if (hasNewsAPI) return 'newsapi'
  return 'none'
}

// -------- Custom RSS aggregator (for curated Korean media) --------
function parseDate(input?: string | null): string {
  if (!input) return new Date().toISOString()
  const d = new Date(input)
  if (!Number.isNaN(d.getTime())) return d.toISOString()
  // Some feeds use numeric timestamps
  const n = Number(input)
  if (!Number.isNaN(n)) return new Date(n).toISOString()
  return new Date().toISOString()
}

function firstText(el: Element | null, selectors: string[]): string | undefined {
  for (const sel of selectors) {
    const n = el?.querySelector(sel)
    const t = n?.textContent?.trim()
    if (t) return t
  }
  return undefined
}

function extractImageFromDescription(html?: string): string | undefined {
  if (!html) return undefined
  try {
    const m = html.match(/<img[^>]*src=["']([^"']+)["']/i)
    if (m && m[1]) return m[1]
  } catch {}
  return undefined
}

function parseRss(xml: string, fallbackSource: string): NewsItem[] {
  const out: NewsItem[] = []
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')
    const channelItems = Array.from(doc.querySelectorAll('rss channel item'))
    const atomEntries = Array.from(doc.querySelectorAll('feed entry'))
    if (channelItems.length) {
      for (const it of channelItems) {
        const title = firstText(it, ['title']) || ''
        const url = firstText(it, ['link']) || ''
        const desc = firstText(it, ['description', 'content\:encoded'])
        const date = firstText(it, ['pubDate', 'published', 'updated'])
        const media = (it.querySelector('media\\:content')?.getAttribute('url')) || extractImageFromDescription(desc)
        const source = firstText(it, ['source']) || fallbackSource
        if (title && url) {
          out.push({
            id: url,
            title,
            summary: desc,
            url,
            image: media || undefined,
            date: parseDate(date),
            source,
          })
        }
      }
    } else if (atomEntries.length) {
      for (const it of atomEntries) {
        const title = firstText(it, ['title']) || ''
        const linkEl = it.querySelector('link')
        const url = (linkEl?.getAttribute('href') || linkEl?.textContent || '').trim()
        const summary = firstText(it, ['summary', 'content'])
        const date = firstText(it, ['updated', 'published'])
        const source = fallbackSource
        if (title && url) {
          out.push({ id: url, title, summary, url, image: extractImageFromDescription(summary), date: parseDate(date), source })
        }
      }
    }
  } catch {
    // ignore
  }
  return out
}

async function fetchRss(url: string, name: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const xml = await res.text()
    return parseRss(xml, name)
  } catch {
    return []
  }
}

type CustomSource = { name: string; url: string; topics?: Topic[] }

function getCustomSources(): CustomSource[] {
  const raw = Deno.env.get('CUSTOM_RSS_SOURCES') || ''
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr
  } catch {}
  // Fallback defaults (can be overridden by secrets). These may need updating per site.
  return [
    { name: 'TokenPost', url: 'https://www.tokenpost.kr/rss' },
    { name: 'BlockMedia', url: 'https://www.blockmedia.co.kr/rss' },
    { name: 'CoinReaders', url: 'https://m.coinreaders.com/plugin/rss' },
    { name: 'BonMedia', url: 'https://www.bonmedia.kr/rss' },
    { name: 'TheGuru', url: 'https://www.theguru.co.kr/rss' },
  ]
}

async function fetchCustom(topic: Topic, limit = 20): Promise<NewsItem[]> {
  const sources = getCustomSources()
  const results = await Promise.all(sources.map((s) => fetchRss(s.url, s.name)))
  let items = results.flat()
  // Very light topic filter by keywords (optional)
  const kwCrypto = /bitcoin|btc|crypto|ethereum|eth|코인|암호|블록체인|가상화폐/i
  const kwFx = /forex|fx|환율|금리|달러|usd|eur|jpy|환전/i
  const kwStocks = /stocks|주식|증시|나스닥|s&p|kospi|코스피|코스닥|기업/i
  items = items.filter((n) => {
    const t = (n.title + ' ' + (n.summary || '')).toLowerCase()
    if (topic === 'crypto') return kwCrypto.test(t)
    if (topic === 'fx') return kwFx.test(t)
    return kwStocks.test(t) || (!kwCrypto.test(t) && !kwFx.test(t))
  })
  // Dedupe by URL
  const seen = new Set<string>()
  const dedup: NewsItem[] = []
  for (const it of items) {
    if (!seen.has(it.url)) { seen.add(it.url); dedup.push(it) }
  }
  dedup.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return dedup.slice(0, limit)
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

async function fetchMarketAux(topic: Topic, page = 1, limit = 10) {
  const token = Deno.env.get('MARKETAUX_KEY')
  if (!token) throw new Error('MARKETAUX_KEY missing')
  const q = topic === 'crypto' ? 'crypto OR bitcoin OR ethereum' : topic === 'fx' ? 'forex OR currency OR usd' : 'stocks OR equities'
  const url = new URL('https://api.marketaux.com/v1/news/all')
  url.searchParams.set('api_token', token)
  url.searchParams.set('language', 'en')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('page', String(page))
  url.searchParams.set('search', q)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`MarketAux ${res.status}`)
  const j = await res.json()
  const items = toItems(j?.data || [], (d: any) => ({
    id: String(d.uuid || d.id || d.url),
    title: String(d.title || ''),
    summary: d.description ? String(d.description) : undefined,
    url: String(d.url),
    image: d.image_url || undefined,
    date: new Date(d?.published_at || d?.created_at || Date.now()).toISOString(),
    source: d?.source || 'MarketAux',
  }))
  const hasMore = Array.isArray(items) && items.length >= limit
  return { items, nextPage: hasMore ? page + 1 : undefined }
}

async function fetchFinnhub(topic: Topic, minId?: string) {
  const token = Deno.env.get('FINNHUB_KEY')
  if (!token) throw new Error('FINNHUB_KEY missing')
  const cat = topic === 'crypto' ? 'crypto' : topic === 'fx' ? 'forex' : 'general'
  const url = new URL('https://finnhub.io/api/v1/news')
  url.searchParams.set('category', cat)
  if (minId) url.searchParams.set('minId', minId)
  url.searchParams.set('token', token)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Finnhub ${res.status}`)
  const j = await res.json()
  const items = toItems(j || [], (d: any) => ({
    id: String(d.id),
    title: String(d.headline || d.title || ''),
    summary: d.summary ? String(d.summary) : undefined,
    url: String(d.url || ''),
    image: d.image || undefined,
    date: new Date((d.datetime || d.time || Date.now()) * 1000).toISOString(),
    source: d.source || 'Finnhub',
  }))
  const cursor = items.length ? String(items[items.length - 1].id) : undefined
  return { items, cursor }
}

async function fetchNewsAPI(topic: Topic, page = 1, pageSize = 10) {
  const token = Deno.env.get('NEWSAPI_KEY')
  if (!token) throw new Error('NEWSAPI_KEY missing')
  const q = topic === 'crypto' ? 'crypto OR bitcoin OR ethereum' : topic === 'fx' ? 'forex OR currency OR usd' : 'stock market OR equities'
  const url = new URL('https://newsapi.org/v2/everything')
  url.searchParams.set('q', q)
  url.searchParams.set('language', 'en')
  url.searchParams.set('page', String(page))
  url.searchParams.set('pageSize', String(pageSize))
  url.searchParams.set('apiKey', token)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`NewsAPI ${res.status}`)
  const j = await res.json()
  const items = toItems(j?.articles || [], (a: any) => ({
    id: String(a.url),
    title: String(a.title || ''),
    summary: a.description ? String(a.description) : undefined,
    url: String(a.url),
    image: a.urlToImage || undefined,
    date: new Date(a.publishedAt || Date.now()).toISOString(),
    source: a?.source?.name || 'NewsAPI',
  }))
  const totalResults = Number(j?.totalResults || 0)
  const maxPage = Math.ceil(totalResults / pageSize)
  return { items, nextPage: page < maxPage ? page + 1 : undefined }
}

function pickImage(d: any): string | undefined {
  try {
    const preview = d?.preview?.images?.[0]?.source?.url as string | undefined
    if (preview) return preview.replace(/&amp;/g, '&')
  } catch {}
  const thumb = typeof d?.thumbnail === 'string' ? d.thumbnail : undefined
  if (thumb && thumb.startsWith('http')) return thumb
  return undefined
}

async function fetchReddit(topic: Topic, after?: string, limit = 10) {
  const sub = topic === 'crypto' ? 'CryptoCurrency' : topic === 'fx' ? 'Forex' : 'stocks'
  const url = new URL(`https://www.reddit.com/r/${sub}/hot.json`)
  url.searchParams.set('limit', String(limit))
  if (after) url.searchParams.set('after', after)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Reddit ${res.status}`)
  const json = await res.json()
  const children: any[] = json?.data?.children || []
  const items: NewsItem[] = children.map(({ data: d }: any) => ({
    id: String(d.id),
    title: String(d.title),
    summary: d.selftext ? String(d.selftext).slice(0, 280) : undefined,
    url: `https://www.reddit.com${d.permalink}`,
    image: pickImage(d),
    date: new Date((d.created_utc || d.created) * 1000).toISOString(),
    source: `r/${sub}`,
  }))
  return { items, after: json?.data?.after as string | undefined }
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: withCorsHeaders() })
  }
  try {
    const url = new URL(req.url)
    const isPOST = req.method === 'POST'
    const body = isPOST ? await req.json().catch(() => ({})) : {}
    const qp = url.searchParams
    const topic = ((isPOST ? body?.topic : qp.get('topic')) || 'crypto') as Topic
    const sort = (isPOST ? body?.sort : qp.get('sort')) || 'latest'
    const q = (isPOST ? body?.q : qp.get('q')) || ''
    const forceProvider = ((isPOST ? body?.provider : qp.get('provider')) || '') as Provider
    const lang = (isPOST ? body?.lang : qp.get('lang')) || ''
    const cursor = (isPOST ? body?.cursor : qp.get('cursor')) || undefined
    const page = Number((isPOST ? body?.page : qp.get('page')) || '1')
    const limit = Number((isPOST ? body?.limit : qp.get('limit')) || '10')

    const provider = (forceProvider as Provider) || pickProvider()
    const key = cacheKey({ topic, sort, q, provider, lang, cursor, page, limit })

    async function buildTopic(t: Exclude<Topic, 'all'>): Promise<{ items: NewsItem[]; nextPage?: number; cursor?: string }> {
      let items: NewsItem[] = []
      let nextPage: number | undefined
      let nextCursor: string | undefined
      try {
        if (provider === 'marketaux') {
          const res = await fetchMarketAux(t, page, limit)
          items = res.items
          nextPage = res.nextPage
        } else if (provider === 'finnhub') {
          const res = await fetchFinnhub(t, cursor)
          items = res.items
          nextCursor = res.cursor
        } else if (provider === 'newsapi') {
          const res = await fetchNewsAPI(t, page, limit)
          items = res.items
          nextPage = res.nextPage
        } else if (provider === 'reddit') {
          const res = await fetchReddit(t, cursor, limit)
          items = res.items
          nextCursor = res.after
        } else if (provider === 'none') {
          items = await fetchCustom(t, limit)
        } else {
          items = []
        }
      } catch (_e) {
        try { items = await fetchCustom(t, limit) } catch { items = [] }
      }
      // filter/sort
      let list = items
      if (q) { const qq = q.toLowerCase(); list = list.filter((n) => n.title.toLowerCase().includes(qq) || (n.summary || '').toLowerCase().includes(qq)) }
      if (sort === 'latest') { list = list.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) }
      return { items: list, nextPage, cursor: nextCursor }
    }

    function dedupeNews(arr: NewsItem[]): NewsItem[] {
      const seen = new Set<string>()
      const out: NewsItem[] = []
      for (const it of arr) {
        const key = (it.url || it.id).trim().toLowerCase()
        if (key && !seen.has(key)) { seen.add(key); out.push(it) }
      }
      return out
    }

    async function build(): Promise<{ items: NewsItem[]; nextPage?: number; cursor?: string; provider: string }> {
      if (topic === 'all') {
        const [c, s, f] = await Promise.all([
          buildTopic('crypto'),
          buildTopic('stocks'),
          buildTopic('fx'),
        ])
        const merged = dedupeNews([...(c.items||[]), ...(s.items||[]), ...(f.items||[])])
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, limit)
        return { items: merged, provider }
      }
      let items: NewsItem[] = []
      let nextPage: number | undefined
      let nextCursor: string | undefined
      try {
        if (provider === 'marketaux') {
          const res = await fetchMarketAux(topic as Exclude<Topic,'all'>, page, limit)
          items = res.items
          nextPage = res.nextPage
        } else if (provider === 'finnhub') {
          const res = await fetchFinnhub(topic as Exclude<Topic,'all'>, cursor)
          items = res.items
          nextCursor = res.cursor
        } else if (provider === 'newsapi') {
          const res = await fetchNewsAPI(topic as Exclude<Topic,'all'>, page, limit)
          items = res.items
          nextPage = res.nextPage
        } else if (provider === 'reddit') {
          const res = await fetchReddit(topic as Exclude<Topic,'all'>, cursor, limit)
          items = res.items
          nextCursor = res.after
        } else if (provider === 'none') {
          items = await fetchCustom(topic as Exclude<Topic,'all'>, limit)
        } else {
          items = []
        }
      } catch (_e) {
        try { items = await fetchCustom(topic as Exclude<Topic,'all'>, limit) } catch { items = [] }
      }
      // simple filter/sort
      let list = items
      if (q) { const qq = q.toLowerCase(); list = list.filter((n) => n.title.toLowerCase().includes(qq) || (n.summary || '').toLowerCase().includes(qq)) }
      if (sort === 'latest') { list = list.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) }
      return { items: list, nextPage, cursor: nextCursor, provider }
    }

    const cached = cache.get(key)
    if (cached) {
      const fresh = Date.now() - cached.ts < CACHE_TTL_MS
      if (!fresh) {
        // SWR: refresh in background but return stale immediately
        ;(async () => { try { const d = await build(); cache.set(key, { ts: Date.now(), data: d }) } catch {} })()
      }
      return json(cached.data)
    }

    const data = await build()
    cache.set(key, { ts: Date.now(), data })
    return json(data)
    // Note: translation was removed in the cached fast-path to keep latency low.
  } catch (e) {
    return json({ error: String(e?.message || e) }, { status: 500 })
  }
})
