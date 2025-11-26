// deno-lint-ignore-file no-explicit-any
// OXBIT | Supabase Edge Function: news-stream
// TokenPost + BlockMedia 통합 타임라인 (CoinReaders 제거), cursor 기반 페이징

type NewsItem = {
  title: string
  summary: string
  link: string
  thumbnail: string
  publishedAt: string
  source: 'TOKENPOST' | 'BLOCKMEDIA'
}

const PAGE_SIZE = 20
const PLACEHOLDER = ''

function withCorsHeaders(headers: HeadersInit = {}) {
  return {
    'content-type': 'application/json; charset=utf-8',
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

// Helpers
function cleanText(s?: string | null): string {
  if (!s) return ''
  try {
    let out = String(s)
      .replace(/<!\[CDATA\[/g, '')
      .replace(/\]\]>/g, '')
      .trim()
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
  } catch {
    return String(s || '')
  }
}
function parseDate(input?: string | null): string {
  if (!input) return new Date().toISOString()
  const d = new Date(input)
  if (!Number.isNaN(d.getTime())) return d.toISOString()
  const n = Number(input)
  if (!Number.isNaN(n)) return new Date(n).toISOString()
  return new Date().toISOString()
}
function sanitizeImage(u?: string | null): string | undefined {
  const v = cleanText(u)
  if (!v) return undefined
  if (v.startsWith('//')) return `https:${v}`
  if (/^https?:\/\//i.test(v)) return v
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
function stripHtml(html?: string): string {
  if (!html) return ''
  try {
    return cleanText(html.replace(/<[^>]+>/g, ' '))
      .replace(/[\s\u00A0]+/g, ' ')
      .trim()
  } catch { return cleanText(html) }
}
function firstText(el: Element | null, selectors: string[]): string | undefined {
  for (const sel of selectors) {
    const n = el?.querySelector(sel)
    const t = n?.textContent?.trim()
    if (t) return t
  }
  return undefined
}
function normalizeUrl(u: string): string {
  try {
    const x = new URL(u)
    const del: string[] = []
    x.searchParams.forEach((_, k) => { if (k.startsWith('utm_')) del.push(k) })
    del.forEach((k) => x.searchParams.delete(k))
    x.hash = ''
    return x.toString()
  } catch {
    return (u || '').trim()
  }
}
function shortenSummary(s?: string): string {
  if (!s) return ''
  return s.length > 150 ? s.slice(0, 150) + '...' : s
}

function parseRss(xml: string) {
  const out: { title: string; link: string; summary?: string; date: string; image?: string }[] = []
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')
    const items = Array.from(doc.querySelectorAll('rss channel item'))
    for (const it of items) {
      const title = cleanText(firstText(it, ['title']) || '')
      const link = cleanText(firstText(it, ['link']) || '')
      const desc = cleanText(firstText(it, ['description', 'content\\:encoded']))
      const date = cleanText(firstText(it, ['pubDate', 'published', 'updated']))
      const media = sanitizeImage(
        it.querySelector('media\\:content')?.getAttribute('url') ||
        it.querySelector('enclosure')?.getAttribute('url') ||
        extractImageFromDescription(desc),
      )
      if (title && link) {
        out.push({
          title,
          link,
          summary: desc,
          date: parseDate(date),
          image: media,
        })
      }
    }
  } catch {}
  return out
}
function parseRssFallback(xml: string) {
  const items: { title: string; link: string; summary?: string; date: string; image?: string }[] = []
  try {
    const re = /<item[\s\S]*?<\/item>/gi
    const blocks = xml.match(re) || []
    for (const b of blocks) {
      const pick = (tag: string) =>
        (b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')) || [,''])[1].trim()
      const title = cleanText(pick('title'))
      const link = cleanText(pick('link'))
      const desc = cleanText(pick('description'))
      const date = pick('pubDate') || pick('published')
      const img = sanitizeImage(extractImageFromDescription(desc))
      if (title && link) {
        items.push({ title, link, summary: desc, date: parseDate(date), image: img })
      }
    }
  } catch {}
  return items
}

async function fetchRssWithFallback(url: string): Promise<ReturnType<typeof parseRss>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, {
      headers: {
        'accept': 'application/rss+xml, application/xml, text/xml; charset=utf-8',
        'user-agent': 'OXBIT.NewsStream/1.0 (+https://oxbit.app)',
      },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(String(res.status))
    const buf = new Uint8Array(await res.arrayBuffer())
    const encs = ['utf-8', 'euc-kr', 'ks_c_5601-1987', 'cp949'] as const
    for (const enc of encs) {
      try {
        // @ts-ignore Deno legacy enc
        const decoder = new TextDecoder(enc, { fatal: false })
        const xml = decoder.decode(buf)
        let items = parseRss(xml)
        if (!items.length) items = parseRssFallback(xml)
        if (items.length) return items
      } catch {}
    }
    throw new Error('parse_failed')
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchSource(url: string) {
  const items = await fetchRssWithFallback(url).catch(() => [])
  return items
}

async function buildTimeline(cursor?: string) {
  // CoinReaders 제외, TokenPost + BlockMedia만 사용
  const [tokenpost, blockmedia] = await Promise.all([
    fetchSource('https://m.tokenpost.kr/rss'),
    fetchSource('https://www.blockmedia.co.kr/rss'),
  ])

  const merged: NewsItem[] = []
  tokenpost.forEach((it) => merged.push({
    title: cleanText(it.title),
    summary: shortenSummary(stripHtml(it.summary)),
    link: cleanText(it.link),
    thumbnail: sanitizeImage(it.image) || sanitizeImage(extractImageFromDescription(it.summary)) || PLACEHOLDER,
    publishedAt: parseDate(it.date),
    source: 'TOKENPOST',
  }))
  blockmedia.forEach((it) => merged.push({
    title: cleanText(it.title),
    summary: shortenSummary(stripHtml(it.summary)),
    link: cleanText(it.link),
    thumbnail: sanitizeImage(it.image) || sanitizeImage(extractImageFromDescription(it.summary)) || PLACEHOLDER,
    publishedAt: parseDate(it.date),
    source: 'BLOCKMEDIA',
  }))

  // dedupe by normalized link
  const seen = new Set<string>()
  const dedup = merged.filter((n) => {
    const key = normalizeUrl(n.link)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // sort desc
  const sorted = dedup.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

  let startIdx = 0
  if (cursor) {
    const ctime = new Date(cursor).getTime()
    startIdx = sorted.findIndex((n) => new Date(n.publishedAt).getTime() <= ctime)
    if (startIdx < 0) startIdx = sorted.length
  }
  const page = sorted.slice(startIdx, startIdx + PAGE_SIZE)
  const nextCursor = page.length ? page[page.length - 1].publishedAt : null

  return { items: page, nextCursor }
}

Deno.serve(async (req) => {
  const { pathname, searchParams } = new URL(req.url)
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (!pathname.endsWith('/news-stream')) return json({ error: 'not_found' }, { status: 404 })

  try {
    const cursor = searchParams.get('cursor') || undefined
    const data = await buildTimeline(cursor)
    return json({ items: data.items, nextCursor: data.nextCursor })
  } catch (e: any) {
    return json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
})
