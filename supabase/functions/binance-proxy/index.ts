// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: binance-proxy
// Path: /functions/v1/binance-proxy
// - Proxies selected Binance (and optional CoinGecko) endpoints to avoid CORS
// - Simple in-memory rate limit (3 req / sec per client)

type EndpointKey =
  | 'futures_openInterest'
  | 'futures_longShortRatio'
  | 'futures_premiumIndex'
  | 'spot_ticker'
  | 'cg_simple_price'
  | 'cg_ticker'

function cors(headers: HeadersInit = {}, origin?: string | null, allowed = true) {
  // If whitelist is enforced and origin is not allowed, set ACAO to 'null' to block browsers
  const acao = allowed ? (origin || '*') : 'null'
  return {
    'access-control-allow-origin': acao,
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'content-type': 'application/json; charset=utf-8',
    ...headers,
  }
}

function json(body: unknown, init: ResponseInit = {}, origin?: string | null, allowed = true) {
  return new Response(JSON.stringify(body), { ...init, headers: cors(init.headers, origin, allowed) })
}

// Very light rate limiter: 3 req / sec by client key
const rateMap = new Map<string, number[]>()
const MAX_PER_SEC = 3

function clientKey(req: Request): string {
  const h = req.headers
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('cf-connecting-ip') ||
    h.get('x-real-ip') ||
    'anon'
  const ua = h.get('user-agent') || ''
  return `${ip}|${ua}`
}

function rateLimited(key: string): boolean {
  const now = Date.now()
  const winStart = now - 1000
  const list = (rateMap.get(key) || []).filter((t) => t >= winStart)
  if (list.length >= MAX_PER_SEC) {
    rateMap.set(key, list)
    return true
  }
  list.push(now)
  rateMap.set(key, list)
  return false
}

function buildUrl(ep: EndpointKey, qp: URLSearchParams): string | null {
  const symbol = qp.get('symbol') || ''
  const period = qp.get('period') || '5m'
  switch (ep) {
    case 'futures_openInterest':
      if (!symbol) return null
      return `https://fapi.binance.com/fapi/v1/openInterest?symbol=${encodeURIComponent(symbol)}`
    case 'futures_longShortRatio':
      if (!symbol) return null
      return `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${encodeURIComponent(symbol)}&period=${encodeURIComponent(period)}&limit=1`
    case 'futures_premiumIndex':
      if (!symbol) return null
      return `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`
    case 'spot_ticker':
      if (!symbol) return null
      return `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`
    case 'cg_simple_price': {
      // example: vs=usd&ids=bitcoin,ethereum
      const ids = qp.get('ids') || 'bitcoin'
      const vs = qp.get('vs') || 'usd'
      return `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vs)}`
    }
    case 'cg_ticker': {
      const id = qp.get('id') || 'bitcoin'
      return `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}`
    }
    default:
      return null
  }
}

// Tiny in-memory cache: dedupe bursts and reduce upstream rate
const cache = new Map<string, { ts: number; data: any }>()
// 10s cache to soften upstream rate limits
const CACHE_TTL_MS = 10_000

async function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
  try {
    const cached = cache.get(url)
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cached.data
    }
  } catch {}
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const r = await fetch(url, { signal: controller.signal })
    const text = await r.text()
    // If not ok, still pass through body for debugging
    try {
      const data = JSON.parse(text)
      try { cache.set(url, { ts: Date.now(), data }) } catch {}
      return data
    } catch {
      const data = { status: r.status, body: text }
      try { cache.set(url, { ts: Date.now(), data }) } catch {}
      return data
    }
  } finally {
    clearTimeout(id)
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || null
  const allowList = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const enforce = allowList.length > 0
  const allowed = !enforce || (origin ? allowList.includes(origin) : true)

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors({}, origin, allowed) })
  try {
    // Block early if origin not allowed
    if (!allowed) return json({ error: 'forbidden_origin' }, { status: 403 }, origin, false)

    const key = clientKey(req)
    if (rateLimited(key)) return json({ error: 'rate_limit' }, { status: 429 })

    const url = new URL(req.url)
    const qp = url.searchParams
    const endpoint = (qp.get('endpoint') || '').trim() as EndpointKey
    const direct = qp.get('url')

    let target: string | null = null
    if (direct) target = direct
    else target = buildUrl(endpoint, qp)

    if (!target) return json({ error: 'invalid_params' }, { status: 400 }, origin, allowed)

    const data = await fetchJson(target)
    return json(data, {}, origin, allowed)
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, { status: 500 }, origin, true)
  }
})
