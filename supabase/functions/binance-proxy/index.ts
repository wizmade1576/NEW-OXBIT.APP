// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: binance-proxy (optimized)
// - CORS allowlist with wildcard support
// - Client rate limit (3 req/sec per client)
// - In-memory cache (default 10s) + symbol metrics cache (60s)
// - Bulk helpers: op=ticker24h (all futures 24h stats)
// - Aggregation helpers: op=metrics&symbols=BTCUSDT,ETHUSDT&period=5m

type EndpointKey =
  | 'futures_openInterest'
  | 'futures_longShortRatio'
  | 'futures_premiumIndex'

function cors(headers: HeadersInit = {}, origin?: string | null, allowed = true) {
  const acao = allowed ? (origin || '*') : 'null'
  return {
    'access-control-allow-origin': acao,
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'vary': 'Origin',
    'content-type': 'application/json; charset=utf-8',
    ...headers,
  }
}

function json(body: unknown, init: ResponseInit = {}, origin?: string | null, allowed = true) {
  return new Response(JSON.stringify(body), { ...init, headers: cors(init.headers, origin, allowed) })
}

// ---------------- Rate limit (per client) ----------------
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
  if (list.length >= MAX_PER_SEC) { rateMap.set(key, list); return true }
  list.push(now); rateMap.set(key, list); return false
}

// ---------------- Small cache helpers ----------------
const cache = new Map<string, { ts: number; data: any; ttl: number }>()
function getCache<T = any>(key: string): T | null {
  const item = cache.get(key)
  if (!item) return null
  if (Date.now() - item.ts <= item.ttl) return item.data as T
  cache.delete(key)
  return null
}
function setCache(key: string, data: any, ttl: number) {
  cache.set(key, { ts: Date.now(), data, ttl })
}

async function fetchJson(url: string, ttl = 10_000, timeoutMs = 8000): Promise<any> {
  const ck = `u:${url}|ttl:${ttl}`
  const c = getCache<any>(ck)
  if (c) return c
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const r = await fetch(url, { signal: controller.signal })
    const text = await r.text()
    let data: any
    try { data = JSON.parse(text) } catch { data = { status: r.status, body: text } }
    setCache(ck, data, ttl)
    return data
  } finally { clearTimeout(id) }
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
    default:
      return null
  }
}

async function metricsForSymbol(sym: string, period = '5m'): Promise<{ funding?: number; oi?: number; long?: number; short?: number }> {
  const key = `m:${sym}:${period}`
  const cached = getCache<any>(key)
  if (cached) return cached

  // 60s metrics cache
  const ttl = 60_000
  const [fundRes, oiRes, ratioRes] = await Promise.allSettled([
    fetchJson(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${encodeURIComponent(sym)}`, ttl),
    fetchJson(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${encodeURIComponent(sym)}`, ttl),
    fetchJson(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${encodeURIComponent(sym)}&period=${encodeURIComponent(period)}&limit=1`, ttl),
  ])

  let funding: number | undefined
  if (fundRes.status === 'fulfilled') {
    const v = Number((fundRes.value?.lastFundingRate) ?? NaN)
    if (Number.isFinite(v)) funding = Math.abs(v) <= 1 ? v * 100 : v
  }
  let oi: number | undefined
  if (oiRes.status === 'fulfilled') {
    const v = Number((oiRes.value?.openInterest) ?? NaN)
    if (Number.isFinite(v)) oi = v
  }
  let long: number | undefined
  let short: number | undefined
  if (ratioRes.status === 'fulfilled') {
    const arr = Array.isArray(ratioRes.value) ? ratioRes.value : []
    const item = arr[arr.length - 1]
    const lp = Number((item?.longAccount) ?? NaN)
    const sp = Number((item?.shortAccount) ?? NaN)
    if (Number.isFinite(lp) && Number.isFinite(sp)) { long = lp; short = sp }
  }

  const out = { funding, oi, long, short }
  setCache(key, out, ttl)
  return out
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || null
  const allowList = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const enforce = allowList.length > 0

  function matchOrigin(token: string, org: string): boolean {
    try {
      const u = new URL(org)
      const oProto = u.protocol
      const oHost = u.hostname
      const oPort = u.port
      const m = token.match(/^(https?:)\/\/(.+)$/)
      if (!m) return token === org
      const tProto = m[1]
      let hostPort = m[2]
      const anyPort = hostPort.endsWith(':*')
      if (anyPort) hostPort = hostPort.slice(0, -2)
      let tHost = hostPort
      let tPort: string | undefined
      if (hostPort.includes(':')) { const [h, p] = hostPort.split(':'); tHost = h; tPort = p }
      if (tProto !== oProto) return false
      const wildcard = tHost.startsWith('*.')
      const base = wildcard ? tHost.slice(2) : tHost
      const hostOk = wildcard ? (oHost === base || oHost.endsWith('.' + base)) : (oHost === tHost)
      if (!hostOk) return false
      if (anyPort) return true
      if (!tPort) return oPort === ''
      return oPort === tPort
    } catch { return false }
  }

  const allowed = !enforce || (origin ? allowList.some(t => matchOrigin(t, origin)) : true)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors({}, origin, allowed) })

  try {
    if (!allowed) return json({ error: 'forbidden_origin' }, { status: 403 }, origin, false)

    const key = clientKey(req)
    if (rateLimited(key)) return json({ error: 'rate_limit' }, { status: 429 }, origin, true)

    const url = new URL(req.url)
    const qp = url.searchParams

    // Aggregated / optimized ops
    const op = (qp.get('op') || '').trim()
    if (op === 'ticker24h') {
      // Bulk futures 24h stats
      const data = await fetchJson('https://fapi.binance.com/fapi/v1/ticker/24hr', 10_000)
      return json(data, {}, origin, true)
    }
    if (op === 'metrics') {
      const symbols = (qp.get('symbols') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 50)
      const period = (qp.get('period') || '5m')
      const out: Record<string, any> = {}
      // Limit parallelism to avoid upstream rate limits
      for (const sym of symbols) {
        // Sequential to stay within ~3 req/s (3 per symbol but all cached 60s)
        out[sym] = await metricsForSymbol(sym, period)
        await new Promise(res => setTimeout(res, 200))
      }
      return json(out, {}, origin, true)
    }

    if (op === 'bundle') {
      const ex = (qp.get('ex') || '').toLowerCase()
      const topN = Math.max(1, Math.min(50, Number(qp.get('topN') || '10') || 10))
      const period = (qp.get('period') || '5m')
      const rankBy = (qp.get('rankBy') || 'volume').toLowerCase() // 'volume' | 'oi'

      if (ex === 'binance') {
        const data: any[] = await fetchJson('https://fapi.binance.com/fapi/v1/ticker/24hr', 10_000)
        const rows = (Array.isArray(data) ? data : [])
          .filter(it => String(it.symbol).endsWith('USDT'))
          .map((it: any) => ({
            symbol: String(it.symbol),
            price: Number(it.lastPrice),
            change24h: Number(it.priceChangePercent),
            volume: Number(it.quoteVolume),
            contractType: 'PERP',
          }))
        async function topByVolume(): Promise<{ topSymbols: string[], metrics: Record<string, any> }> {
          const syms = rows.slice().sort((a, b) => ((b.volume || 0) - (a.volume || 0))).slice(0, topN).map(r => r.symbol)
          const metrics: Record<string, any> = {}
          for (const sym of syms) { metrics[sym] = await metricsForSymbol(sym, period); await new Promise(res => setTimeout(res, 150)) }
          return { topSymbols: syms, metrics }
        }
        async function topByOI(): Promise<{ topSymbols: string[], metrics: Record<string, any> }> {
          // Limit candidate set to reduce upstream calls
          const candidates = rows.slice().sort((a, b) => ((b.volume || 0) - (a.volume || 0))).slice(0, Math.max(20, topN * 2))
          const list: { sym: string; oiUsd: number }[] = []
          const metrics: Record<string, any> = {}
          for (const r of candidates) {
            const m = await metricsForSymbol(r.symbol, period)
            metrics[r.symbol] = m
            const oiQty = Number(m?.oi ?? NaN)
            const price = Number(r.price ?? NaN)
            const oiUsd = Number.isFinite(oiQty) && Number.isFinite(price) ? oiQty * price : 0
            list.push({ sym: r.symbol, oiUsd })
            await new Promise(res => setTimeout(res, 120))
          }
          const topSyms = list.sort((a, b) => b.oiUsd - a.oiUsd).slice(0, topN).map(x => x.sym)
          return { topSymbols: topSyms, metrics }
        }
        const result = rankBy === 'oi' ? await topByOI() : await topByVolume()
        return json({ rows, topSymbols: result.topSymbols, metrics: result.metrics }, {}, origin, true)
      }

      if (ex === 'bybit') {
        const tickers = await fetchJson('https://api.bybit.com/v5/market/tickers?category=linear', 10_000)
        const info = await fetchJson('https://api.bybit.com/v5/market/instruments-info?category=linear', 10_000)
        const infoList: any[] = info?.result?.list || []
        const typeMap = new Map<string, string>()
        for (const it of infoList) {
          const ct = String(it?.contractType || '').toLowerCase().includes('perpetual') ? 'PERP' : 'FUTURES'
          if (it?.symbol) typeMap.set(String(it.symbol), ct)
        }
        const list: any[] = tickers?.result?.list || []
        const rows = list.map((it: any) => ({
          symbol: String(it.symbol),
          price: Number(it.lastPrice),
          change24h: Math.abs(Number(it.price24hPcnt)) <= 1 ? Number(it.price24hPcnt) * 100 : Number(it.price24hPcnt),
          funding: Math.abs(Number(it.fundingRate)) <= 1 ? Number(it.fundingRate) * 100 : Number(it.fundingRate),
          volume: Number(it.turnover24h),
          oi: Number(it.openInterestValue) || Number(it.openInterest),
          contractType: (typeMap.get(String(it.symbol)) as any) || 'PERP',
        }))
        const topSymbols = (rankBy === 'oi'
          ? rows.slice().sort((a, b) => ((b.oi || 0) - (a.oi || 0)))
          : rows.slice().sort((a, b) => ((b.volume || 0) - (a.volume || 0)))
        ).slice(0, topN).map(r => r.symbol)
        // Bybit metrics: reuse row data to avoid extra calls
        const metrics: Record<string, any> = {}
        for (const r of rows) {
          const m: any = {}
          if (Number.isFinite(r.funding as number)) m.funding = r.funding
          if (Number.isFinite(r.oi as number)) m.oi = r.oi // already a value in quote currency
          if (Object.keys(m).length) metrics[r.symbol] = m
        }
        return json({ rows, topSymbols, metrics }, {}, origin, true)
      }

      if (ex === 'okx') {
        const j = await fetchJson('https://www.okx.com/api/v5/market/tickers?instType=SWAP', 10_000)
        const list: any[] = j?.data || []
        const rows = list.map((it: any) => ({
          symbol: String(it.instId || '').replace(/-SWAP$/, '').replace('-', ''),
          instId: String(it.instId || ''),
          price: Number(it.last),
          change24h: Math.abs(Number(it.sodUtc8 || it.change24h)) <= 1 ? Number(it.sodUtc8 || it.change24h) * 100 : Number(it.sodUtc8 || it.change24h),
          volume: Number(it.volCcy24h || it.vol24h),
          contractType: 'PERP',
        }))
        // Compute topSymbols by requested key (default volume)
        let topSymbols = rows.slice().sort((a, b) => ((b.volume || 0) - (a.volume || 0))).slice(0, topN).map(r => r.symbol)
        const metrics: Record<string, any> = {}
        // If rankBy=oi, fetch OI for candidate set (top 2N by volume) and re-rank
        if (rankBy === 'oi') {
          const candidates = rows.slice().sort((a, b) => ((b.volume || 0) - (a.volume || 0))).slice(0, Math.max(20, topN * 2))
          const measured: { sym: string; oiUsd: number }[] = []
          for (const r of candidates) {
            try {
              const fr = await fetchJson(`https://www.okx.com/api/v5/public/funding-rate?instId=${encodeURIComponent(r.symbol + '-SWAP')}`, 60_000)
              const oir = await fetchJson(`https://www.okx.com/api/v5/public/open-interest?instId=${encodeURIComponent(r.symbol + '-SWAP')}`, 60_000)
              const frate = Number((fr?.data?.[0]?.fundingRate) ?? NaN)
              if (Number.isFinite(frate)) { metrics[r.symbol] = { ...(metrics[r.symbol]||{}), funding: Math.abs(frate) <= 1 ? frate * 100 : frate } }
              const oiCcy = Number((oir?.data?.[0]?.oiCcy) ?? NaN)
              const oiQty = Number((oir?.data?.[0]?.oi) ?? NaN)
              // Prefer OI in quote currency if available, else multiply qty * price
              let oiUsd = 0
              if (Number.isFinite(oiCcy)) oiUsd = oiCcy
              else if (Number.isFinite(oiQty) && Number.isFinite(r.price as number)) oiUsd = oiQty * (r.price as number)
              if (!metrics[r.symbol]) metrics[r.symbol] = {}
              metrics[r.symbol].oi = oiUsd
              measured.push({ sym: r.symbol, oiUsd })
              await new Promise(res => setTimeout(res, 120))
            } catch {}
          }
          topSymbols = measured.sort((a, b) => b.oiUsd - a.oiUsd).slice(0, topN).map(x => x.sym)
        }
        return json({ rows, topSymbols, metrics }, {}, origin, true)
      }

      return json({ error: 'invalid_ex' }, { status: 400 }, origin, true)
    }

    // Pass-through: either direct url=... or endpoint=...
    const endpoint = (qp.get('endpoint') || '').trim() as EndpointKey
    const direct = qp.get('url')
    let target: string | null = null
    if (direct) target = direct
    else target = buildUrl(endpoint, qp)
    if (!target) return json({ error: 'invalid_params' }, { status: 400 }, origin, true)
    const data = await fetchJson(target, 10_000)
    return json(data, {}, origin, true)
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, { status: 500 }, origin, true)
  }
})
