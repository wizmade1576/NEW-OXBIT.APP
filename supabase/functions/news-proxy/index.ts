// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: news-proxy (KR RSS only)
// GET /news-proxy?topic=crypto|stocks|fx|all&sort=latest&q=&limit=30

export type Topic = 'crypto' | 'stocks' | 'fx' | 'all'
export type Provider = 'none'

export interface NewsItem {
  id: string
  title: string
  summary?: string
  url: string
  image?: string
  date: string
  source: string
  topic: Topic
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
  return new Response(JSON.stringify(body), { ...init, headers: withCorsHeaders(init.headers) })
}

function pickProvider(): Provider { return 'none' }

// ---------- Helpers ----------
function parseDate(input?: string | null): string {
  if (!input) return new Date().toISOString()
  const d = new Date(input)
  if (!Number.isNaN(d.getTime())) return d.toISOString()
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
  try { const m = html.match(/<img[^>]*src=["']([^"']+)["']/i); if (m && m[1]) return m[1] } catch {}
  return undefined
}

function cleanText(s?: string | null): string {
  if (!s) return ''
  try {
    let out = String(s)
      .replace(/<!\[CDATA\[/g, '')
      .replace(/\]\]>/g, '')
      .trim()
    // decode basic HTML entities and numeric
    out = out
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
    out = out.replace(/&#(\d+);/g, (_, d) => {
      try { return String.fromCharCode(parseInt(d, 10)) } catch { return _ }
    })
    out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      try { return String.fromCharCode(parseInt(h, 16)) } catch { return _ }
    })
    return out.trim()
  } catch { return String(s || '') }
}

function sanitizeImage(u?: string | null): string | undefined {
  const v = cleanText(u)
  if (!v) return undefined
  if (v.startsWith('//')) return `https:${v}`
  if (/^https?:\/\//i.test(v)) return v
  return undefined
}

function parseRss(xml: string, fallbackSource: string) {
  const out: Omit<NewsItem, 'topic'>[] = []
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')
    const channelItems = Array.from(doc.querySelectorAll('rss channel item'))
    const atomEntries = Array.from(doc.querySelectorAll('feed entry'))
    if (channelItems.length) {
      for (const it of channelItems) {
        const title = cleanText(firstText(it, ['title']) || '')
        const url = cleanText(firstText(it, ['link']) || '')
        const desc = cleanText(firstText(it, ['description', 'content\\:encoded']))
        const date = cleanText(firstText(it, ['pubDate', 'published', 'updated']))
        const media = sanitizeImage(it.querySelector('media\\:content')?.getAttribute('url') || it.querySelector('enclosure')?.getAttribute('url') || extractImageFromDescription(desc))
        const source = cleanText(firstText(it, ['source']) || fallbackSource)
        if (title && url) out.push({ id: url, title, summary: desc, url, image: media, date: parseDate(date), source })
      }
    } else if (atomEntries.length) {
      for (const it of atomEntries) {
        const title = cleanText(firstText(it, ['title']) || '')
        const linkEl = it.querySelector('link')
        const url = cleanText((linkEl?.getAttribute('href') || linkEl?.textContent || '').trim())
        const summary = cleanText(firstText(it, ['summary', 'content']))
        const date = firstText(it, ['updated', 'published'])
        const image = sanitizeImage(extractImageFromDescription(summary))
        if (title && url) out.push({ id: url, title, summary, url, image, date: parseDate(date), source: fallbackSource })
      }
    }
  } catch {}
  return out
}

function parseRssFallback(xml: string, source: string): Omit<NewsItem, 'topic'>[] {
  const items: Omit<NewsItem, 'topic'>[] = []
  try {
    const re = /<item[\s\S]*?<\/item>/gi
    const blocks = xml.match(re) || []
    for (const b of blocks) {
      const pick = (tag: string) => (b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')) || [,''])[1].trim()
      const title = cleanText(pick('title'))
      const link = cleanText(pick('link'))
      const desc = cleanText(pick('description'))
      const date = pick('pubDate') || pick('published')
      const image = sanitizeImage(extractImageFromDescription(desc))
      if (title && link) items.push({ id: link, title, summary: desc, url: link, image, date: parseDate(date), source })
    }
  } catch {}
  return items
}

async function fetchRss(url: string, name: string): Promise<Omit<NewsItem, 'topic'>[]> {
  const controller = new AbortController()
  const to = setTimeout(() => controller.abort(), 3500)
  try {
    const res = await fetch(url, {
      headers: {
        'accept': 'application/rss+xml, application/xml, text/xml; charset=utf-8',
        'user-agent': 'OXBIT.NewsProxy/1.0 (+https://oxbit.app)'
      },
      signal: controller.signal,
    })
    if (!res.ok) return []
    const xml = await res.text()
    const list = parseRss(xml, name)
    if (list.length) return list
    return parseRssFallback(xml, name)
  } catch { return [] } finally { clearTimeout(to) }
}

// ---------- KR RSS Sources ----------
const RSS_SOURCES: { name: string; url: string; defaultTopic: Topic }[] = [
  { name: 'TokenPost',  url: 'https://www.tokenpost.kr/rss', defaultTopic: 'crypto' },
  { name: 'BlockMedia', url: 'https://www.blockmedia.co.kr/feed', defaultTopic: 'crypto' },
  { name: 'CoinReaders', url: 'https://www.coinreaders.com/rss/rss_news.php', defaultTopic: 'crypto' },
  { name: 'BonMedia',   url: 'https://bonmedia.kr/rss', defaultTopic: 'crypto' },
  { name: 'TheGuru',    url: 'https://www.theguru.co.kr/rss', defaultTopic: 'stocks' },
]

function classifyTopic(title?: string, summary?: string, fallback: Topic = 'crypto'): Topic {
  const t = (title || '').toLowerCase()
  const s = (summary || '').toLowerCase()
  const txt = `${t} ${s}`
  const has = (...ks: string[]) => ks.some(k => txt.includes(k.toLowerCase()))
  if (has('비트코인','코인','암호화폐','블록체인','가상자산','업비트','바이낸스')) return 'crypto'
  if (has('주식','증시','나스닥','기업','글로벌','경제','s&p','코스피','코스닥','다우')) return 'stocks'
  if (has('환율','금리','달러','usd','환전','외환','채권','연준','fed')) return 'fx'
  return fallback
}

function normalizeUrl(u: string): string {
  try {
    const x = new URL(u)
    const dels: string[] = []
    x.searchParams.forEach((_, k) => { if (k.toLowerCase().startsWith('utm_')) dels.push(k) })
    dels.forEach(k => x.searchParams.delete(k))
    x.hash = ''
    return x.toString()
  } catch { return (u || '').trim() }
}

async function fetchCustom(topic: Topic, limit = 30): Promise<NewsItem[]> {
  const settles = await Promise.allSettled(RSS_SOURCES.map(s => fetchRss(s.url, s.name)))
  const all: NewsItem[] = []
  RSS_SOURCES.forEach((src, i) => {
    const list = settles[i].status === 'fulfilled' ? settles[i].value : []
    for (const it of list) {
      const t = classifyTopic(it.title, it.summary, src.defaultTopic)
      all.push({ ...it, title: cleanText(it.title), summary: cleanText(it.summary), image: sanitizeImage(it.image), topic: t })
    }
  })
  const seen = new Set<string>()
  const dedup = all.filter(n => { const key = normalizeUrl(n.url || n.id); if (seen.has(key)) return false; seen.add(key); return true })
  let filtered = topic === 'all' ? dedup : dedup.filter(n => n.topic === topic)
  if (filtered.length === 0 && topic !== 'all') {
    const sourceFallback = dedup.filter(n => {
      const src = RSS_SOURCES.find(s => s.name === n.source)
      return src?.defaultTopic === topic
    })
    if (sourceFallback.length) filtered = sourceFallback
  }
  return filtered.slice().sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime())
}

// ---------- Cache (10s) ----------
const CACHE_TTL_MS = 10_000
const cache = new Map<string, { ts: number; data: any }>()
// thumbnail cache (binary)
const IMG_CACHE_TTL_MS = 60 * 60 * 1000 // 1h
const imgCache = new Map<string, { ts: number; buf: Uint8Array; type: string }>()
const keyOf = (params: Record<string, unknown>) => Object.entries(params).sort().map(([k,v])=>`${k}=${String(v ?? '')}`).join('&')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: withCorsHeaders() })
  try {
    const url = new URL(req.url)
    const qp = url.searchParams
    // Thumbnail proxy endpoint
    if (qp.get('thumb') === '1') {
      const src = qp.get('u') || ''
      const w = Math.max(1, Math.min(640, Number(qp.get('w') || '160') || 160))
      const h = Math.max(1, Math.min(640, Number(qp.get('h') || '90') || 90))
      if (!/^https?:\/\//i.test(src)) return json({ error: 'invalid_url' }, { status: 400 })
      const key = `t:${w}x${h}:${src}`
      const cached = imgCache.get(key)
      if (cached && Date.now() - cached.ts < IMG_CACHE_TTL_MS) {
        return new Response(cached.buf, { status: 200, headers: withCorsHeaders({ 'content-type': cached.type, 'cache-control': 'max-age=3600' }) })
      }
      // Use images.weserv.nl for resizing; function acts as a caching proxy to avoid client 429s
      const wsrv = `https://images.weserv.nl/?url=${encodeURIComponent(src)}&w=${w}&h=${h}&fit=cover&we=1&il`
      const controller = new AbortController()
      const to = setTimeout(() => controller.abort(), 5000)
      try {
        const r = await fetch(wsrv, { signal: controller.signal })
        if (!r.ok) return json({ error: `thumb_upstream_${r.status}` }, { status: 502 })
        const type = r.headers.get('content-type') || 'image/jpeg'
        const buf = new Uint8Array(await r.arrayBuffer())
        imgCache.set(key, { ts: Date.now(), buf, type })
        return new Response(buf, { status: 200, headers: withCorsHeaders({ 'content-type': type, 'cache-control': 'max-age=3600' }) })
      } finally { clearTimeout(to) }
    }
    const topic = (qp.get('topic') as Topic) || 'crypto'
    const sort = qp.get('sort') || 'latest'
    const q = qp.get('q') || ''
    const limit = Number(qp.get('limit') || '30')

    const provider = pickProvider() // 'none'

    async function build() {
      let items: NewsItem[]
      if (topic === 'all') {
        const [c, s, f] = await Promise.all([
          fetchCustom('crypto', limit),
          fetchCustom('stocks', limit),
          fetchCustom('fx', limit),
        ])
        items = [...c, ...s, ...f].sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime())
      } else {
        items = await fetchCustom(topic, limit)
      }
      if (q) {
        const qq = q.toLowerCase()
        items = items.filter(n => n.title.toLowerCase().includes(qq) || (n.summary || '').toLowerCase().includes(qq))
      }
      if (sort === 'latest') items = items.slice().sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime())
      // replace image with function thumbnail proxy
      const base = `${url.origin}/functions/v1/news-proxy`
      const itemsWithThumb = items.map(n => ({
        ...n,
        image: n.image ? `${base}?thumb=1&u=${encodeURIComponent(n.image)}&w=160&h=90` : undefined,
      }))
      return { items: itemsWithThumb, provider }
    }

    const cacheKey = keyOf({ topic, sort, q, limit })
    const c = cache.get(cacheKey)
    if (c && Date.now() - c.ts < CACHE_TTL_MS) return json(c.data)
    const data = await build()
    cache.set(cacheKey, { ts: Date.now(), data })
    return json(data)
  } catch (e) {
    return json({ error: String(e?.message || e), provider: 'none' }, { status: 500 })
  }
})
