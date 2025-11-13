import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'

type ContractType = 'PERP' | 'FUTURES'

type Row = {
  symbol: string
  instId?: string // for OKX
  price?: number
  change24h?: number // percent
  funding?: number // percent
  oi?: number // USD
  long?: number // percent
  short?: number // percent
  volume?: number // USD
  contractType?: ContractType
}

export default function FuturesPage() {
  const [exchange, setExchange] = React.useState<'Binance' | 'Bybit' | 'OKX'>('Bybit')
  const [sortBy, setSortBy] = React.useState<'volume' | 'funding' | 'oi' | 'change24h'>('volume')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc')
  const [query, setQuery] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<'ALL' | ContractType>('ALL')
  const [rows, setRows] = React.useState<Row[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [ratioMap, setRatioMap] = React.useState<Record<string, { long: number; short: number }>>({})
  const [currency, setCurrency] = React.useState<'USD'|'KRW'>('USD')
  const [usdkrw, setUsdkrw] = React.useState<number>(0)
  const TOP_LIMIT = 50
  const PAGE_SIZE = 25
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE)
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)

  // USD→KRW 환율: KRW 모드에서만 주기적 갱신(캐시 사용)
  React.useEffect(() => {
    if (currency !== 'KRW') return
    let mounted = true
    const cacheKey = 'usdkrw_cache_v1'
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null')
      if (cached && typeof cached.rate === 'number') setUsdkrw(cached.rate)
    } catch {}
    let delay = 0
    const pull = async () => {
      try {
        const r = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=KRW')
        if (!r.ok) throw new Error(String(r.status))
        const j = await r.json()
        const rate = j?.rates?.KRW
        if (mounted && typeof rate === 'number') {
          setUsdkrw(rate)
          try { localStorage.setItem(cacheKey, JSON.stringify({ rate, ts: Date.now() })) } catch {}
          delay = 6*60*60*1000
        }
      } catch {
        delay = Math.min(delay ? delay*2 : 60_000, 5*60*1000)
      } finally {
        if (mounted) setTimeout(pull, delay || 60_000)
      }
    }
    pull()
    return () => { mounted = false }
  }, [currency])

  // Fetchers per exchange (currently: Bybit full data; others fallback minimal)
  React.useEffect(() => {
    let mounted = true
    let timer: any
    const pull = async () => {
      try {
        setLoading(true)
        setError(null)
        if (exchange === 'Bybit') {
          const tickersUrl = 'https://api.bybit.com/v5/market/tickers?category=linear'
          const infoUrl = 'https://api.bybit.com/v5/market/instruments-info?category=linear'
          const [tickersRes, infoRes] = await Promise.all([
            fetch(tickersUrl),
            fetch(infoUrl),
          ])
          if (!tickersRes.ok || !infoRes.ok) throw new Error('Bybit API error')
          const tickersJson = await tickersRes.json()
          const infoJson = await infoRes.json()
          const infoList: any[] = infoJson?.result?.list || []
          const typeMap = new Map<string, ContractType>()
          for (const it of infoList) {
            const ct = String(it?.contractType || '').toLowerCase().includes('perpetual') ? 'PERP' : 'FUTURES'
            if (it?.symbol) typeMap.set(String(it.symbol), ct as ContractType)
          }
          const list: any[] = tickersJson?.result?.list || []
          const parsed: Row[] = list.map((it: any) => ({
            symbol: String(it.symbol),
            price: num(it.lastPrice),
            change24h: percent(it.price24hPcnt),
            funding: percent(it.fundingRate),
            volume: num(it.turnover24h),
            oi: num(it.openInterestValue) || num(it.openInterest),
            contractType: typeMap.get(String(it.symbol)) || 'PERP',
          }))
          if (mounted) setRows(parsed)
          // enrich Binance: 상위 50개 심볼에 대해 펀딩/OI/롱숏 비율 수집
          try {
            const top = [...parsed].sort((a,b)=>((b.volume||0)-(a.volume||0))).slice(0, 50)
            for (const r of top) {
              const sym = r.symbol
              try {
                const [fundingRes, oiRes, ratioRes] = await Promise.allSettled([
                  fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}`),
                  fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${sym}`),
                  fetch(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=5m&limit=1`),
                ])
                let funding: number | undefined
                if (fundingRes.status === 'fulfilled' && fundingRes.value.ok) {
                  const j = await fundingRes.value.json()
                  funding = percent(j?.lastFundingRate)
                }
                let oiUsd: number | undefined
                if (oiRes.status === 'fulfilled' && oiRes.value.ok) {
                  const j = await oiRes.value.json()
                  const oiQty = num(j?.openInterest)
                  if (oiQty && r.price) oiUsd = oiQty * r.price
                }
                if (funding !== undefined || oiUsd !== undefined) {
                  setRows(prev => prev.map(x => x.symbol===sym ? { ...x, funding: x.funding ?? funding, oi: x.oi ?? oiUsd } : x))
                }
                if (ratioRes.status === 'fulfilled' && ratioRes.value.ok) {
                  const arr = await ratioRes.value.json()
                  const item = Array.isArray(arr) ? arr[arr.length-1] : (arr?.[0] || arr?.data?.[0])
                  let longPct: number | undefined, shortPct: number | undefined
                  const lsr = Number(item?.longShortRatio)
                  const la = Number(item?.longAccount)
                  const sa = Number(item?.shortAccount)
                  if (Number.isFinite(lsr) && lsr>0) { longPct = (lsr/(1+lsr))*100; shortPct = 100-longPct }
                  else if (Number.isFinite(la) && Number.isFinite(sa)) {
                    const sum = la+sa; if (sum>0) { longPct = (la/sum)*100; shortPct = 100-longPct }
                  }
                  if (longPct!==undefined && shortPct!==undefined) {
                    setRatioMap(prev => ({ ...prev, [sym]: { long: longPct!, short: shortPct! } }))
                  }
                }
              } catch {}
              await new Promise(r => setTimeout(r, 150))
            }
          } catch {}
        } else if (exchange === 'Binance') {
          // Minimal: 24h ticker for USDⓢ-M futures (no funding/OI in bulk). Fill unknowns as undefined.
          const res = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr')
          if (!res.ok) throw new Error('Binance API error')
          const data: any[] = await res.json()
          const parsed: Row[] = (Array.isArray(data) ? data : []).filter(it => typeof it?.symbol === 'string' && it.symbol.endsWith('USDT')).slice(0, 200).map((it: any) => ({
            symbol: String(it.symbol),
            price: num(it.lastPrice),
            change24h: num(it.priceChangePercent),
            volume: num(it.quoteVolume),
            contractType: 'PERP',
          }))
          if (mounted) setRows(parsed)
          // enrich OKX: 상위 50개 심볼에 대해 펀딩/OI/롱숏 비율 수집
          try {
            const top = [...parsed].sort((a,b)=>((b.volume||0)-(a.volume||0))).slice(0, 50)
            for (const r of top) {
              const instId = (r as any).instId || `${r.symbol.replace('USDT','')}-USDT-SWAP`
              const base = (instId.split('-')[0] || '').toUpperCase()
              try {
                const [fundingRes, oiRes, ratioRes] = await Promise.allSettled([
                  fetch(`https://www.okx.com/api/v5/public/funding-rate?instId=${encodeURIComponent(instId)}`),
                  fetch(`https://www.okx.com/api/v5/public/open-interest?instId=${encodeURIComponent(instId)}`),
                  fetch(`https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${encodeURIComponent(base)}&period=5m`),
                ])
                let funding: number | undefined
                if (fundingRes.status==='fulfilled' && fundingRes.value.ok) {
                  const jj = await fundingRes.value.json(); const d = jj?.data?.[0]; funding = percent(d?.fundingRate)
                }
                let oiUsd: number | undefined
                if (oiRes.status==='fulfilled' && oiRes.value.ok) {
                  const jj = await oiRes.value.json(); const d = jj?.data?.[0]
                  const oiCcy = num(d?.oiCcy) || num(d?.oi)
                  if (oiCcy && r.price) oiUsd = oiCcy * (r.price as number)
                }
                if (funding !== undefined || oiUsd !== undefined) {
                  setRows(prev => prev.map(x => x.symbol===r.symbol ? { ...x, funding: x.funding ?? funding, oi: x.oi ?? oiUsd } : x))
                }
                if (ratioRes.status==='fulfilled' && ratioRes.value.ok) {
                  const jj = await ratioRes.value.json();
                  const arr: any[] = jj?.data || []
                  const last = Array.isArray(arr) && arr.length ? arr[arr.length-1] : null
                  const ratio = Number(last?.ratio)
                  if (Number.isFinite(ratio) && ratio>0) {
                    const longPct = (ratio/(1+ratio))*100; const shortPct = 100-longPct
                    setRatioMap(prev => ({ ...prev, [r.symbol]: { long: longPct, short: shortPct } }))
                  }
                }
              } catch {}
              await new Promise(r => setTimeout(r, 150))
            }
          } catch {}
        } else if (exchange === 'OKX') {
          const res = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SWAP')
          if (!res.ok) throw new Error('OKX API error')
          const j = await res.json()
          const list: any[] = j?.data || []
          const parsed: Row[] = list.map((it: any) => ({
            symbol: String(it.instId || '').replace(/-SWAP$/, '').replace('-', ''),
            instId: String(it.instId || ''),
            price: num(it.last),
            change24h: percent(it.sodUtc8 || it.change24h || it.last) /* best-effort */,
            volume: num(it.volCcy24h || it.vol24h),
            contractType: 'PERP',
          }))
          if (mounted) setRows(parsed)
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'error')
      } finally {
        if (mounted) setLoading(false)
        // refresh every 30s
        timer = setTimeout(pull, 30_000)
      }
    }
    pull()
    return () => { mounted = false; if (timer) clearTimeout(timer) }
  }, [exchange])

  // Fetch long/short ratio for Bybit lazily for visible symbols
  React.useEffect(() => {
    if (exchange !== 'Bybit') return
    const want = rows.map(r => r.symbol).filter(sym => !(sym in ratioMap)).slice(0, 30)
    if (want.length === 0) return
    let mounted = true
    ;(async () => {
      for (const sym of want) {
        try {
          const url = `https://api.bybit.com/v5/market/account-ratio?symbol=${encodeURIComponent(sym)}&period=5min`
          const res = await fetch(url)
          if (!res.ok) continue
          const j = await res.json()
          const list: any[] = j?.result?.list || []
          const last: any = Array.isArray(list) && list.length ? list[list.length - 1] : null
          const long = Math.max(0, Math.min(100, (Number(last?.buyRatio) || 0) * 100))
          const short = Math.max(0, Math.min(100, (Number(last?.sellRatio) || 0) * 100))
          if (mounted && (long || short)) {
            setRatioMap(prev => ({ ...prev, [sym]: { long, short } }))
          }
        } catch {}
        await new Promise(r => setTimeout(r, 200)) // small gap to be kind to API
      }
    })()
    return () => { mounted = false }
  }, [exchange, rows, ratioMap])

  const filteredSorted = React.useMemo(() => {
    let list = rows
    if (typeFilter !== 'ALL') list = list.filter(r => r.contractType === typeFilter)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(r => r.symbol.toLowerCase().includes(q))
    }
    const dir = sortDir === 'asc' ? 1 : -1
    const k = sortBy
    list = [...list].sort((a, b) => ((a[k] ?? -Infinity) as number - (b[k] ?? -Infinity) as number) * dir)
    return list
  }, [rows, query, typeFilter, sortBy, sortDir])

  // filters 변경 시 보이는 개수 초기화
  React.useEffect(() => { setVisibleCount(PAGE_SIZE) }, [exchange, query, typeFilter, sortBy, sortDir])

  // 무한스크롤 sentinel
  React.useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        setVisibleCount(c => Math.min(c + PAGE_SIZE, Math.min(TOP_LIMIT, filteredSorted.length)))
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [filteredSorted.length])

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="hidden">
              <CardTitle>선물 마켓</CardTitle>
              <CardDescription>실시간 선물 지표 (거래소/정렬/검색/필터)</CardDescription>
            </div>
            <div>
              <CardTitle>선물 마켓</CardTitle>
              <CardDescription>실시간 선물 지표 (거래소/정렬/검색/필터)</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                aria-label="거래소 선택"
                value={exchange}
                onChange={(e) => setExchange(e.target.value as any)}
                className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm"
              >
                <option>Binance</option>
                <option>Bybit</option>
                <option>OKX</option>
              </select>
              <select
                aria-label="정렬 기준"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm"
              >
                <option value="volume">거래량(24h)</option>
                <option value="funding">펀딩비</option>
                <option value="oi">미결제약정(OI)</option>
                <option value="change24h">24h 변동률</option>
              </select>
              <button
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] hover:bg-[#1e1e1e] text-sm"
                aria-label="정렬 방향 전환"
                title="정렬 방향 전환"
              >
                {sortDir === 'desc' ? '내림차순' : '오름차순'}
              </button>
              <div className="flex items-center gap-1">
                <button onClick={()=>setCurrency('USD')} className={`px-2 py-1 rounded border border-neutral-700 text-sm ${currency==='USD'?'bg-emerald-600/20 text-emerald-300':'bg-[#1a1a1a] hover:bg-[#1e1e1e]'}`}>USD</button>
                <button onClick={()=>setCurrency('KRW')} className={`px-2 py-1 rounded border border-neutral-700 text-sm ${currency==='KRW'?'bg-emerald-600/20 text-emerald-300':'bg-[#1a1a1a] hover:bg-[#1e1e1e]'}`}>KRW</button>
              </div>
              <select
                aria-label="종류 필터"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm"
              >
                <option value="ALL">전체</option>
                <option value="PERP">Perp</option>
                <option value="FUTURES">분기물</option>
              </select>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="심볼 검색 (예: BTCUSDT)"
                className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm flex-1 min-w-[160px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-xs text-amber-300 mb-2">API 오류: {error}</div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="hidden">
                <tr className="text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">심볼</th>
                  <th className="px-3 py-2 text-right font-medium">현재가</th>
                  <th className="px-3 py-2 text-right font-medium">24h</th>
                  <th className="px-3 py-2 text-right font-medium">펀딩비</th>
                  <th className="px-3 py-2 text-right font-medium hidden sm:table-cell">미결제약정</th>
                  <th className="px-3 py-2 text-right font-medium hidden md:table-cell">롱/숏</th>
                  <th className="px-3 py-2 text-right font-medium">거래량(24h)</th>
                </tr>
              </thead>
              <thead>
                <tr className="text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">심볼</th>
                  <th className="px-3 py-2 text-right font-medium">현재가</th>
                  <th className="px-3 py-2 text-right font-medium">24h</th>
                  <th className="px-3 py-2 text-right font-medium">펀딩비</th>
                  <th className="px-3 py-2 text-right font-medium hidden sm:table-cell">미결제약정</th>
                  <th className="px-3 py-2 text-right font-medium hidden md:table-cell">롱/숏</th>
                  <th className="px-3 py-2 text-right font-medium">거래량(24h)</th>
                </tr>
              </thead>
              <tbody>
                {filteredSorted.slice(0, TOP_LIMIT).slice(0, visibleCount).map((r) => {
                  const ratio = ratioMap[r.symbol]
                  const long = ratio?.long ?? r.long
                  const short = ratio?.short ?? r.short
                  return (
                    <tr key={`${exchange}-${r.symbol}`} className="border-t border-border hover:bg-accent/20 transition-colors">
                      <td className="px-3 py-2 font-medium">{r.symbol}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(convert(r.price, currency, usdkrw), currency)}</td>
                      <td className={`px-3 py-2 text-right ${pctClass(r.change24h)}`}>{fmtPct(r.change24h)}</td>
                      <td className={`px-3 py-2 text-right ${pctClass(r.funding)}`}>{fmtPct(r.funding)}</td>
                      <td className="px-3 py-2 text-right hidden sm:table-cell">{formatCurrency(convert(r.oi, currency, usdkrw), currency)}</td>
                      <td className="px-3 py-2 text-right hidden md:table-cell"><RatioBar longPct={long} shortPct={short} /></td>
                      <td className="px-3 py-2 text-right">{formatCurrency(convert(r.volume, currency, usdkrw), currency)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div ref={sentinelRef} />
          {visibleCount < Math.min(TOP_LIMIT, filteredSorted.length) ? (
            <div className="mt-2 flex justify-center">
              <button onClick={()=>setVisibleCount(c=>Math.min(c+PAGE_SIZE, Math.min(TOP_LIMIT, filteredSorted.length)))} className="px-3 py-1 rounded border border-neutral-700 bg-[#1a1a1a] hover:bg-[#1e1e1e] text-sm">더 보기</button>
            </div>
          ) : null}
          {loading ? <div className="text-xs text-muted-foreground mt-2">업데이트 중...</div> : null}
        </CardContent>
      </Card>
    </section>
  )
}

// FX / formatting helpers are defined below the component

function RatioBar({ longPct, shortPct }: { longPct?: number; shortPct?: number }) {
  const lp = Math.max(0, Math.min(100, Number.isFinite(longPct as number) ? (longPct as number) : 50))
  const sp = Math.max(0, Math.min(100, Number.isFinite(shortPct as number) ? (shortPct as number) : 50))
  const total = lp + sp || 100
  const lw = Math.round((lp / total) * 100)
  const sw = 100 - lw
  const tip = `Long ${lp.toFixed(1)}% / Short ${sp.toFixed(1)}%`
  return (
    <div className="inline-flex items-center gap-2 justify-end" title={tip}>
      <div className="w-32 h-2.5 rounded bg-neutral-800 overflow-hidden grid" style={{ gridTemplateColumns: `${lw}% ${sw}%` }}>
        <div className="bg-emerald-500" />
        <div className="bg-red-500" />
      </div>
      <span className="text-xs text-muted-foreground">L {lp.toFixed(0)}% / S {sp.toFixed(0)}%</span>
    </div>
  )
}

function num(v: any): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

// removed unused fmtUSD

function percent(v?: number | string) {
  const n = Number(v)
  if (!Number.isFinite(n)) return undefined
  // some APIs return 0.0123 => 1.23%
  return Math.abs(n) <= 1 ? n * 100 : n
}

function fmtPct(v?: number) {
  if (!Number.isFinite(v as number)) return '--'
  const n = v as number
  const s = Math.abs(n) < 1 ? n.toFixed(2) : n.toFixed(2)
  const sign = n > 0 ? '+' : ''
  return `${sign}${s}%`
}

function pctClass(v?: number) {
  if (!Number.isFinite(v as number)) return 'text-muted-foreground'
  return (v as number) >= 0 ? 'text-emerald-400' : 'text-red-400'
}

function convert(value?: number, currency: 'USD'|'KRW' = 'USD', usdkrw = 0) {
  if (!Number.isFinite(value as number)) return undefined
  if (currency === 'USD') return value
  if (usdkrw && usdkrw > 0) return (value as number) * usdkrw
  return undefined
}

function formatCurrency(v?: number, currency: 'USD'|'KRW' = 'USD') {
  if (!Number.isFinite(v as number)) return '--'
  return currency === 'USD' ? `$${(v as number).toLocaleString('en-US')}` : `${Math.round(v as number).toLocaleString('ko-KR')}원`
}
