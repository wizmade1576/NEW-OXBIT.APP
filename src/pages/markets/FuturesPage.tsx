import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'

type ContractType = 'PERP' | 'FUTURES'

type Row = {
  symbol: string
  instId?: string
  price?: number
  change24h?: number
  funding?: number
  oi?: number
  long?: number
  short?: number
  volume?: number
  contractType?: ContractType
}

export default function FuturesPage() {

  // --------------------------------------------------------------------
  // 🔥 Binance API CORS 문제 해결용 Proxy 생성기
  // --------------------------------------------------------------------
  const prox = React.useCallback((url: string) => {
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/binance-proxy`
    const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '')
    return {
      url: `${base}?url=${encodeURIComponent(url)}`,
      headers: {
        'Authorization': `Bearer ${anon}`,
        'apikey': anon,
      },
    }
  }, [])

  // --------------------------------------------------------------------
  // 화면 상태값
  // --------------------------------------------------------------------
  const [exchange, setExchange] = React.useState<'Binance' | 'Bybit' | 'OKX'>('Bybit')
  const [sortBy, setSortBy] = React.useState<'volume' | 'funding' | 'oi' | 'change24h'>('volume')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc')
  const [query, setQuery] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<'ALL' | ContractType>('ALL')
  const [rows, setRows] = React.useState<Row[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [ratioMap, setRatioMap] = React.useState<Record<string, { long: number; short: number }>>({})
  const [currency, setCurrency] = React.useState<'USD' | 'KRW'>('USD')
  const [usdkrw, setUsdkrw] = React.useState<number>(0)

  const TOP_LIMIT = 50
  const PAGE_SIZE = 25
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE)
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)

  // --------------------------------------------------------------------
  // USD → KRW 환율 Fetch
  // --------------------------------------------------------------------
  React.useEffect(() => {
    if (currency !== 'KRW') return
    let mounted = true
    const key = 'usdkrw_cache_v1'

    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null')
      if (cached?.rate) setUsdkrw(cached.rate)
    } catch {}

    const pull = async () => {
      try {
        const r = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=KRW')
        if (!r.ok) throw 1
        const j = await r.json()
        const rate = j?.rates?.KRW
        if (mounted && rate) {
          setUsdkrw(rate)
          localStorage.setItem(key, JSON.stringify({ rate, ts: Date.now() }))
        }
      } catch {
        setTimeout(pull, 60000)
      }
    }
    pull()
    return () => (mounted = false)
  }, [currency])

  // --------------------------------------------------------------------
  // 📊 메인 데이터 fetch (Bybit / Binance / OKX)
  // --------------------------------------------------------------------
  React.useEffect(() => {
    let mounted = true
    let timer: any

    const pull = async () => {
      try {
        setLoading(true)
        setError(null)

        // --------------------------------------------------------
        // BYBIT
        // --------------------------------------------------------
        if (exchange === 'Bybit') {
          const tUrl = 'https://api.bybit.com/v5/market/tickers?category=linear'
          const iUrl = 'https://api.bybit.com/v5/market/instruments-info?category=linear'

          const [tRes, iRes] = await Promise.all([fetch(tUrl), fetch(iUrl)])
          if (!tRes.ok || !iRes.ok) throw new Error('Bybit API Error')

          const tJson = await tRes.json()
          const iJson = await iRes.json()
          const infoList = iJson?.result?.list || []

          const typeMap = new Map<string, ContractType>()
          for (const it of infoList) {
            const type = String(it.contractType).toLowerCase().includes('perpetual') ? 'PERP' : 'FUTURES'
            typeMap.set(it.symbol, type)
          }

          const list = tJson?.result?.list || []
          const parsed: Row[] = list.map((it: any) => ({
            symbol: it.symbol,
            price: num(it.lastPrice),
            change24h: percent(it.price24hPcnt),
            funding: percent(it.fundingRate),
            volume: num(it.turnover24h),
            oi: num(it.openInterestValue),
            contractType: typeMap.get(it.symbol) || 'PERP',
          }))

          if (mounted) setRows(parsed)

          // --------------------------------------------------------
          // Binance 보조 데이터 (펀딩 / OI / 롱숏 비율)
          // --------------------------------------------------------
          const top = [...parsed]
            .sort((a, b) => (b.volume || 0) - (a.volume || 0))
            .slice(0, 20)

          for (const r of top) {
            const sym = r.symbol

            // Binance API 요청부 — Proxy + Header 적용
            const [f, o, ratio] = await Promise.allSettled([
              fetchBinance(prox, `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}`),
              fetchBinance(prox, `https://fapi.binance.com/fapi/v1/openInterest?symbol=${sym}`),
              fetchBinance(
                prox,
                `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=5m&limit=1`
              ),
            ])

            // 펀딩비
            if (f.status === 'fulfilled' && f.value) {
              const v = percent(f.value.lastFundingRate)
              updateRow(sym, { funding: v })
            }

            // OI
            if (o.status === 'fulfilled' && o.value) {
              const oiQty = num(o.value.openInterest)
              if (oiQty && r.price) {
                updateRow(sym, { oi: oiQty * r.price })
              }
            }

            // 롱숏 비율
            if (ratio.status === 'fulfilled' && ratio.value) {
              const arr = ratio.value
              const last = Array.isArray(arr) ? arr[arr.length - 1] : null
              if (last) {
                const long = num(last.longAccount)
                const short = num(last.shortAccount)
                if (long && short)
                  setRatioMap(prev => ({ ...prev, [sym]: { long, short } }))
              }
            }

              await sleep(1100)
          }
        }

        // --------------------------------------------------------
        // BINANCE
        // --------------------------------------------------------
        else if (exchange === 'Binance') {
          const { url, headers } = prox('https://fapi.binance.com/fapi/v1/ticker/24hr')
          const res = await fetch(url, { headers })
          if (!res.ok) throw new Error('Binance API Error')

          const data = await res.json()
          const parsed: Row[] = data
            .filter((it: any) => String(it.symbol).endsWith('USDT'))
            .slice(0, 200)
            .map((it: any) => ({
              symbol: it.symbol,
              price: num(it.lastPrice),
              change24h: num(it.priceChangePercent),
              volume: num(it.quoteVolume),
              contractType: 'PERP',
            }))

          if (mounted) setRows(parsed)
        }

        // --------------------------------------------------------
        // OKX
        // --------------------------------------------------------
        else if (exchange === 'OKX') {
          const res = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SWAP')
          if (!res.ok) throw new Error('OKX Error')

          const j = await res.json()
          const list = j.data || []

          const parsed: Row[] = list.map((it: any) => ({
            symbol: it.instId.replace(/-SWAP$/, '').replace('-', ''),
            instId: it.instId,
            price: num(it.last),
            change24h: percent(it.sodUtc8),
            volume: num(it.volCcy24h),
            contractType: 'PERP',
          }))

          if (mounted) setRows(parsed)
        }

      } catch (e: any) {
        if (mounted) setError(e.message || 'Error')
      } finally {
        setLoading(false)
        timer = setTimeout(pull, 30000)
      }
    }

    pull()
    return () => {
      mounted = false
      if (timer) clearTimeout(timer)
    }
  }, [exchange])

  // ----------------------------------------------------------
  // 필터링 + 정렬
  // ----------------------------------------------------------
  const filteredSorted = React.useMemo(() => {
    let list = rows
    if (typeFilter !== 'ALL') list = list.filter(r => r.contractType === typeFilter)
    if (query.trim()) list = list.filter(r => r.symbol.toLowerCase().includes(query.trim().toLowerCase()))

    const dir = sortDir === 'asc' ? 1 : -1
    list = [...list].sort((a, b) => ((a[sortBy] ?? -Infinity) - (b[sortBy] ?? -Infinity)) * dir)

    return list
  }, [rows, query, typeFilter, sortBy, sortDir])

  // ----------------------------------------------------------
  // Infinite scroll
  // ----------------------------------------------------------
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

  // ----------------------------------------------------------
  // 렌더링
  // ----------------------------------------------------------
  return (
    <section className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>선물 마켓</CardTitle>
              <CardDescription>실시간 선물 지표</CardDescription>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select value={exchange} onChange={e => setExchange(e.target.value as any)}
                className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm">
                <option>Binance</option>
                <option>Bybit</option>
                <option>OKX</option>
              </select>

              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm">
                <option value="volume">거래량</option>
                <option value="funding">펀딩비</option>
                <option value="oi">OI</option>
                <option value="change24h">24h</option>
              </select>

              <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm">
                {sortDir === 'desc' ? '내림차순' : '오름차순'}
              </button>

              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="BTCUSDT"
                className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm flex-1 min-w-[160px]"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {error && <div className="text-xs text-amber-300 mb-2">API 오류: {error}</div>}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="px-3 py-2 text-left">심볼</th>
                  <th className="px-3 py-2 text-right">현재가</th>
                  <th className="px-3 py-2 text-right">24h</th>
                  <th className="px-3 py-2 text-right">펀딩비</th>
                  <th className="px-3 py-2 text-right">OI</th>
                  <th className="px-3 py-2 text-right">롱/숏</th>
                  <th className="px-3 py-2 text-right">거래량</th>
                </tr>
              </thead>

              <tbody>
                {filteredSorted.slice(0, TOP_LIMIT).slice(0, visibleCount).map(r => {
                  const ratio = ratioMap[r.symbol]
                  return (
                    <tr key={`${exchange}-${r.symbol}`} className="border-t border-border hover:bg-accent/20">
                      <td className="px-3 py-2 font-medium">{r.symbol}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(convert(r.price, currency, usdkrw), currency)}</td>
                      <td className={`px-3 py-2 text-right ${pctClass(r.change24h)}`}>{fmtPct(r.change24h)}</td>
                      <td className={`px-3 py-2 text-right ${pctClass(r.funding)}`}>{fmtPct(r.funding)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(convert(r.oi, currency, usdkrw), currency)}</td>
                      <td className="px-3 py-2 text-right"><RatioBar longPct={ratio?.long} shortPct={ratio?.short} /></td>
                      <td className="px-3 py-2 text-right">{formatCurrency(convert(r.volume, currency, usdkrw), currency)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div ref={sentinelRef} />

          {visibleCount < Math.min(TOP_LIMIT, filteredSorted.length) && (
            <div className="mt-2 flex justify-center">
              <button
                onClick={() => setVisibleCount(c => Math.min(c + PAGE_SIZE, Math.min(TOP_LIMIT, filteredSorted.length)))}
                className="px-3 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm"
              >
                더 보기
              </button>
            </div>
          )}

          {loading && <div className="text-xs text-muted-foreground mt-2">업데이트 중...</div>}
        </CardContent>
      </Card>
    </section>
  )
}

//
// ------------------------------------------------
// 🔥 Helper
// ------------------------------------------------
function RatioBar({ longPct, shortPct }: { longPct?: number; shortPct?: number }) {
  const lp = Math.max(0, Math.min(100, longPct ?? 50))
  const sp = Math.max(0, Math.min(100, shortPct ?? 50))
  const total = lp + sp || 100
  const lw = Math.round((lp / total) * 100)
  const sw = 100 - lw

  return (
    <div className="inline-flex items-center gap-2 justify-end">
      <div className="w-32 h-2.5 rounded bg-neutral-800 overflow-hidden grid"
        style={{ gridTemplateColumns: `${lw}% ${sw}%` }}>
        <div className="bg-emerald-500" />
        <div className="bg-red-500" />
      </div>
      <span className="text-xs text-muted-foreground">L {lp.toFixed(0)}% / S {sp.toFixed(0)}%</span>
    </div>
  )
}

function updateRow(sym: string, patch: Partial<Row>) {
  return (prev: Row[]) => prev.map(x => (x.symbol === sym ? { ...x, ...patch } : x))
}

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms))
}

function num(v: any): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function percent(v?: number | string) {
  const n = Number(v)
  if (!Number.isFinite(n)) return undefined
  return Math.abs(n) <= 1 ? n * 100 : n
}

function fmtPct(v?: number) {
  if (!Number.isFinite(v as number)) return '--'
  return `${v! > 0 ? '+' : ''}${v!.toFixed(2)}%`
}

function pctClass(v?: number) {
  if (!Number.isFinite(v as number)) return 'text-muted-foreground'
  return v! >= 0 ? 'text-emerald-400' : 'text-red-400'
}

function convert(v?: number, currency: 'USD' | 'KRW', rate: number) {
  if (!Number.isFinite(v as number)) return undefined
  return currency === 'USD' ? v : v! * rate
}

function formatCurrency(v?: number, currency: 'USD' | 'KRW') {
  if (!Number.isFinite(v as number)) return '--'
  return currency === 'USD'
    ? `$${v!.toLocaleString('en-US')}`
    : `${Math.round(v!).toLocaleString('ko-KR')}원`
}

async function fetchBinance(
  prox: (url: string) => { url: string; headers: any },
  url: string
) {
  const { url: u, headers } = prox(url)
  const r = await fetch(u, { headers })
  if (!r.ok) return null
  return r.json()
}
