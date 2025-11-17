// ============================================================================
// OXBIT — Supabase Edge Function: news-proxy
// Korean RSS optimized version (TokenPost, BlockMedia, CoinReaders)
// ============================================================================

// deno-lint-ignore-file no-explicit-any

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

// =============== CORS / JSON ================================================

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

function pickProvider(): Provider {
  return 'none'
}

// =============== TEXT CLEANING ==============================================

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
  try {
    const m = html.match(/<img[^>]*src=["']([^"']+)["']/i)
    if (m && m[1]) return m[1]
  } catch {}
  return undefined
}

function cleanText(s?: string | null): string {
  if (!s) return ''
  try {
    let out = String(s)
      .replace(/<!\[CDATA\[/g, '')
      .replace(/\]\]>/g, '')
      .trim()

    // HTML entity decode
    out = out
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
    out = out.replace(/&#(\d+);/g, (_, d) => {
      try {
        return String.fromCharCode(parseInt(d, 10))
      } catch {
        return _
      }
    })

    out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      try {
        return String.fromCharCode(parseInt(h, 16))
      } catch {
        return _
      }
    })

    return out.trim()
  } catch {
    return String(s || '')
  }
}

function sanitizeImage(u?: string | null): string | undefined {
  const v = cleanText(u)
  if (!v) return undefined
  if (v.startsWith('//')) return `https:${v}`
  if (/^https?:\/\//i.test(v)) return v
  return undefined
}

function stripHtml(html?: string): string {
  if (!html) return ''
  try {
    return cleanText(html.replace(/<[^>]+>/g, ' '))
      .replace(/[\s\u00A0]+/g, ' ')
      .trim()
  } catch {
    return cleanText(html)
  }
}

function isGarbled(s?: string | null): boolean {
  if (!s) return false
  const txt = String(s)
  const total = txt.length || 1
  const bad = (txt.match(/\uFFFD/g) || []).length
  if (bad / total > 0.05) return true
  if (/\uFFFD{3,}/.test(txt)) return true
  return false
}

// =============== RSS PARSING =================================================

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
        const media = sanitizeImage(
          it.querySelector('media\\:content')?.getAttribute('url') ||
            it.querySelector('enclosure')?.getAttribute('url') ||
            extractImageFromDescription(desc),
        )
        const source = cleanText(firstText(it, ['source']) || fallbackSource)
        if (title && url)
          out.push({
            id: url,
            title,
            summary: desc,
            url,
            image: media,
            date: parseDate(date),
            source,
          })
      }
    }
  } catch {}
  return out
}
// ============================================================================
// PART 2/3 — RSS SOURCE + FETCH + CUSTOM BUILDER
// ============================================================================

// ---------- RSS Sources (Korean feeds) --------------------
const RSS_SOURCES: { name: string; url: string; defaultTopic: Topic }[] = [
  { name: 'TokenPost',  url: 'https://www.tokenpost.kr/rss', defaultTopic: 'crypto' },
  { name: 'BlockMedia', url: 'https://www.blockmedia.co.kr/feed', defaultTopic: 'crypto' },
  { name: 'CoinReaders', url: 'https://www.coinreaders.com/rss/rss_news.php', defaultTopic: 'crypto' },
]

// ---------- Alternative Mirrors ---------------------------------------------
const ALT_RSS: Record<string, string[]> = {
  TokenPost: [
    'https://m.tokenpost.kr/rss',
    'http://www.tokenpost.kr/rss',
  ],
  BlockMedia: [
    'https://www.blockmedia.co.kr/rss',
  ],
  CoinReaders: [
    'https://m.coinreaders.com/plugin/rss',
  ],
}

// ---------- Fallback RSS Parser ---------------------------------------------
function parseRssFallback(xml: string, source: string): Omit<NewsItem,'topic'>[] {
  const items: Omit<NewsItem,'topic'>[] = []
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
        items.push({
          id: link,
          title,
          summary: desc,
          url: link,
          image: img,
          date: parseDate(date),
          source,
        })
      }
    }
  } catch {}

  return items
}

// ---------- Fetch RSS (UTF-8 + EUC-KR/CP949 auto detect) --------------------
async function fetchRss(url: string, name: string): Promise<Omit<NewsItem,'topic'>[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(url, {
      headers: {
        'accept': 'application/rss+xml, application/xml, text/xml; charset=utf-8',
        'user-agent': 'OXBIT.NewsProxy/1.0 (+https://oxbit.app)',
      },
      signal: controller.signal,
    })

    if (!res.ok) throw new Error(String(res.status))

    const buf = new Uint8Array(await res.arrayBuffer())
    const encodings = ['utf-8', 'euc-kr', 'ks_c_5601-1987', 'cp949'] as const

    for (const enc of encodings) {
      try {
        // @ts-ignore — Deno supports some legacy encodings
        const decoder = new TextDecoder(enc, { fatal: false })
        const xml = decoder.decode(buf)

        let items = parseRss(xml, name)
        if (!items.length) items = parseRssFallback(xml, name)
        if (items.length) return items
      } catch {}
    }

    throw new Error('parse_failed')
  } catch {
    // Fallback: Server-side RSS proxy
    const fallbackUrls = [
      `https://r.jina.ai/http/${url.replace(/^https?:\/\//, '')}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    ]

    for (const u of fallbackUrls) {
      try {
        const r = await fetch(u)
        if (!r.ok) continue
        const xml = await r.text()

        let items = parseRss(xml, name)
        if (!items.length) items = parseRssFallback(xml, name)
        if (items.length) return items
      } catch {}
    }
    return []
  } finally {
    clearTimeout(timeout)
  }
}

// ---------- Try primary first then ALT RSS ---------------------------
async function fetchSourceWithAlts(name: string, primary: string) {
  let list = await fetchRss(primary, name)
  if (list.length) return list

  const alts = ALT_RSS[name] || []
  for (const alt of alts) {
    try {
      const items = await fetchRss(alt, name)
      if (items.length) return items
    } catch {}
  }

  return list
}

// ---------- Classify topic from Title/Content ------------------------
function classifyTopic(
  title?: string,
  summary?: string,
  fallback: Topic = 'crypto'
): Topic {
  const t = (title || '').toLowerCase()
  const s = (summary || '').toLowerCase()
  const txt = `${t} ${s}`

  const has = (...words: string[]) =>
    words.some((w) => txt.includes(w.toLowerCase()))

  if (has('비트코인', '코인', '암호화폐', '가상자산', '블록체인', '업비트', '바이낸스'))
    return 'crypto'

  if (has('주식', '증시', '나스닥', 's&p', '코스피', '코스닥', '다우', '기업'))
    return 'stocks'

  if (has('환율', '금리', '달러', 'usd', '환전', '외환', 'fed', '연준'))
    return 'fx'

  return fallback
}

// ---------- Normalize URL (remove UTM/etc) --------------------------
function normalizeUrl(u: string): string {
  try {
    const x = new URL(u)
    const del: string[] = []
    x.searchParams.forEach((_, k) => {
      if (k.startsWith('utm_')) del.push(k)
    })
    del.forEach(k => x.searchParams.delete(k))
    x.hash = ''
    return x.toString()
  } catch {
    return (u || '').trim()
  }
}

// ---------- Fetch per topic + dedupe + sort -------------------------
async function fetchCustom(topic: Topic, limit = 30): Promise<NewsItem[]> {
  const settles = await Promise.allSettled(
    RSS_SOURCES.map((s) => fetchSourceWithAlts(s.name, s.url))
  )

  const all: NewsItem[] = []

  RSS_SOURCES.forEach((src, i) => {
    const list = settles[i].status === 'fulfilled' ? settles[i].value : []
    for (const it of list) {
      const t = classifyTopic(it.title, it.summary, src.defaultTopic)
      all.push({
        ...it,
        title: cleanText(it.title),
        summary: cleanText(it.summary),
        image: sanitizeImage(it.image),
        topic: t,
      })
    }
  })

  // dedupe
  const seen = new Set<string>()
  const dedup = all.filter(n => {
    const key = normalizeUrl(n.url || n.id)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // filter by topic
  let filtered =
    topic === 'all'
      ? dedup
      : dedup.filter((n) => n.topic === topic)

  // fallback: if empty, use defaultTopic matching feeds
  if (!filtered.length && topic !== 'all') {
    filtered = dedup.filter((n) => {
      const src = RSS_SOURCES.find((s) => s.name === n.source)
      return src?.defaultTopic === topic
    })
  }

  const out = filtered
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return out
}

// ============================================================================
// PART 3/3 이어짐
// ============================================================================
// ============================================================================
// PART 3/3 — CACHE + THUMBNAIL PROXY + MAIN HANDLER
// ============================================================================

// JSON 응답 캐시 TTL (기본 10초)
const CACHE_TTL_MS = Number(Deno.env.get('CACHE_TTL_MS') ?? '10000')
const cache = new Map<string, { ts: number; data: any }>()

// 썸네일 바이너리 캐시 TTL (기본 1시간)
const IMG_CACHE_TTL_MS = Number(Deno.env.get('IMG_CACHE_TTL_MS') ?? String(60 * 60 * 1000))
const imgCache = new Map<string, { ts: number; buf: Uint8Array; type: string }>()

async function hashKey(s: string): Promise<string> {
  const enc = new TextEncoder().encode(s)
  const digest = await crypto.subtle.digest('SHA-1', enc)
  const arr = Array.from(new Uint8Array(digest))
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function keyOf(params: Record<string, unknown>): string {
  return Object.entries(params)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${String(v ?? '')}`)
    .join('&')
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: withCorsHeaders() })
  }

  try {
    const url = new URL(req.url)
    const qp = url.searchParams

    // ------------------------------------------------------------------------
    // 1) 썸네일 프록시 엔드포인트 (?thumb=1&u=원본이미지URL)
    // ------------------------------------------------------------------------
    if (qp.get('thumb') === '1') {
      const src = qp.get('u') || ''
      const defaultW = Number(Deno.env.get('THUMB_WIDTH') ?? '160')
      const defaultH = Number(Deno.env.get('THUMB_HEIGHT') ?? '90')

      const w = Math.max(1, Math.min(640, Number(qp.get('w') || String(defaultW)) || defaultW))
      const h = Math.max(1, Math.min(640, Number(qp.get('h') || String(defaultH)) || defaultH))

      if (!/^https?:\/\//i.test(src)) {
        return json({ error: 'invalid_url' }, { status: 400 })
      }

      let fmt = (qp.get('fmt') || Deno.env.get('THUMB_FMT') || 'webp').toLowerCase()
      if (fmt === 'auto') {
        const accept = (req.headers.get('accept') || '').toLowerCase()
        fmt = accept.includes('image/avif')
          ? 'avif'
          : accept.includes('image/webp')
          ? 'webp'
          : 'jpeg'
      }

      const qDefault = Number(Deno.env.get('THUMB_QUALITY') ?? '75')
      const qParam = Number(qp.get('q') || String(qDefault)) || qDefault
      const quality = Math.max(1, Math.min(100, qParam))

      const keyPlain = `t:${w}x${h}:${fmt}:${src}`
      const hashed = await hashKey(keyPlain)

      // 메모리 캐시 우선
      const cached = imgCache.get(hashed)
      if (cached && Date.now() - cached.ts < IMG_CACHE_TTL_MS) {
        return new Response(cached.buf, {
          status: 200,
          headers: withCorsHeaders({
            'content-type': cached.type,
            'cache-control': 'max-age=3600',
          }),
        })
      }

      // images.weserv.nl 이용해서 리사이즈
      const wsrv = `https://images.weserv.nl/?url=${encodeURIComponent(
        src,
      )}&w=${w}&h=${h}&fit=cover&we=1&il&output=${fmt}&q=${quality}`

      const controller = new AbortController()
      const to = setTimeout(() => controller.abort(), 5000)

      try {
        const r = await fetch(wsrv, { signal: controller.signal })
        if (!r.ok) {
          return json({ error: `thumb_upstream_${r.status}` }, { status: 502 })
        }

        const type =
          r.headers.get('content-type') ||
          (fmt === 'webp' ? 'image/webp' : fmt === 'avif' ? 'image/avif' : 'image/jpeg')
        const buf = new Uint8Array(await r.arrayBuffer())

        imgCache.set(hashed, { ts: Date.now(), buf, type })

        return new Response(buf, {
          status: 200,
          headers: withCorsHeaders({
            'content-type': type,
            'cache-control': 'max-age=3600',
          }),
        })
      } finally {
        clearTimeout(to)
      }
    }

    // ------------------------------------------------------------------------
    // 2) 뉴스 JSON 엔드포인트
    //    /news-proxy?topic=crypto|stocks|fx|all&limit=30&page=1&q=&sort=latest
    // ------------------------------------------------------------------------
    const topic = (qp.get('topic') as Topic) || 'crypto'
    const sort = qp.get('sort') || 'latest'
    const q = qp.get('q') || ''
    const limit = Math.max(1, Math.min(100, Number(qp.get('limit') || '30')))
    const page = Math.max(1, Number(qp.get('page') || '1') || 1)

    function finalizeItem(n: NewsItem): NewsItem {
      // summary 정리 + 길이 제한
      let summary = stripHtml(cleanText(n.summary))
      if (summary.length > 240) summary = summary.slice(0, 240) + '...'

      // 이미지 정리
      let image = sanitizeImage(n.image)
      if (!image) {
        const raw = cleanText(n.summary)
        image = sanitizeImage(extractImageFromDescription(raw))
      }

      return { ...n, summary, image }
    }

    async function build() {
      let items: NewsItem[]
      // pagination 지원을 위해 여유 있게 가져오기
      const poolSize = Math.min(100, limit * Math.max(2, page + 1))

      if (topic === 'all') {
        const [c, s, f] = await Promise.all([
          fetchCustom('crypto', poolSize),
          fetchCustom('stocks', poolSize),
          fetchCustom('fx', poolSize),
        ])

        items = [...c, ...s, ...f]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .map(finalizeItem)
      } else {
        items = (await fetchCustom(topic, poolSize)).map(finalizeItem)
      }

      // 검색어 필터
      if (q) {
        const qq = q.toLowerCase()
        items = items.filter(
          (n) =>
            n.title.toLowerCase().includes(qq) ||
            (n.summary || '').toLowerCase().includes(qq),
        )
      }

      // 정렬 (기본: 최신순)
      if (sort === 'latest') {
        items = items
          .slice()
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }

      // 썸네일 프록시 URL로 변환
      const base = `${url.origin}/functions/v1/news-proxy`
      const thumbFmt = (Deno.env.get('THUMB_FMT') || 'webp').toLowerCase()
      const thumbQ = String(
        Math.max(1, Math.min(100, Number(Deno.env.get('THUMB_QUALITY') ?? '75'))),
      )
      const defW = Number(Deno.env.get('THUMB_WIDTH') ?? '160')
      const defH = Number(Deno.env.get('THUMB_HEIGHT') ?? '90')

      const itemsWithThumb = items.map((n) => ({
        ...n,
        image: n.image
          ? `${base}?thumb=1&u=${encodeURIComponent(
              n.image,
            )}&w=${defW}&h=${defH}&fmt=${thumbFmt}&q=${thumbQ}`
          : undefined,
      }))

      // 글자 깨진 뉴스 제거
      const cleaned = itemsWithThumb.filter(
        (n) => !isGarbled(n.title) && !isGarbled(n.summary),
      )

      // 페이지네이션
      const offset = (page - 1) * limit
      const paged = cleaned.slice(offset, offset + limit)
      const hasMore = cleaned.length > offset + paged.length
      const nextPage = hasMore ? page + 1 : undefined

      return { items: paged, nextPage: nextPage ?? null, nextCursor: null }
    }

    // 캐시 확인
    const cacheKey = keyOf({ topic, sort, q, limit, page })
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return json(cached.data)
    }

    const data = await build()
    const normalized = {
      items: data.items || [],
      nextPage: data.nextPage ?? null,
      nextCursor: data.nextCursor ?? null,
    }

    cache.set(cacheKey, { ts: Date.now(), data: normalized })

    return json(normalized)
  } catch (_e) {
    // 실패해도 UI 터지지 않게 항상 빈 리스트 반환
    return json(
      { items: [], nextPage: null, nextCursor: null },
      { status: 200 },
    )
  }
})
