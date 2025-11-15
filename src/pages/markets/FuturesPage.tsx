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
  // Proxy helper to call Supabase Edge Function
  const prox = React.useCallback((qs: string) => {
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/binance-proxy`
    const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '')
    const url = `${base}?${qs}`
    const headers: Record<string, string> = {}
    if (anon) { headers['Authorization'] = `Bearer ${anon}`; headers['apikey'] = anon }
    return { url, headers }
  }, [])

  const [exchange, setExchange] = React.useState<'Binance' | 'Bybit' | 'OKX'>('Binance')
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

  // FX rate (6h refresh)
  React.useEffect(() => {
    if (currency !== 'KRW') return
    let mounted = true
    const key = 'usdkrw_cache_v1'
    try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c?.rate) setUsdkrw(c.rate) } catch {}
    const pull = async () => {
      try {
        const r = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=KRW')
        if (!r.ok) throw 1
        const j = await r.json(); const rate = j?.rates?.KRW
        if (mounted && typeof rate === 'number') { setUsdkrw(rate); try { localStorage.setItem(key, JSON.stringify({ rate, ts: Date.now() })) } catch {} }
      } catch {}
      if (mounted) setTimeout(pull, 6 * 60 * 60 * 1000)
    }
    pull(); return () => { mounted = false }
  }, [currency])

  // Main fetch (every 3 minutes). Use Edge Function bundle for all exchanges
  React.useEffect(() => {
    let mounted = true
    let timer: any
    const nextMs = 180_000
    const pull = async () => {
      try {
        setLoading(true); setError(null)
        if (exchange === 'Binance') {
          const { url, headers } = prox('op=bundle&ex=binance&topN=10&period=5m')
          const r = await fetch(url, { headers })
          if (!r.ok) throw new Error('Binance bundle')
          const j = await r.json()
          const parsed: Row[] = (j?.rows || [])
          if (mounted) setRows(parsed)
          // merge metrics if present
          const mm = j?.metrics || {}
          if (mm && Object.keys(mm).length) {
            setRows(prev => prev.map(x => {
              const m = mm[x.symbol]; if (!m) return x
              const add: Partial<Row> = {}
              if (typeof m.funding === 'number') add.funding = m.funding
              if (typeof m.oi === 'number' && typeof x.price === 'number') add.oi = m.oi * x.price
              return { ...x, ...add }
            }))
            const nextRatio: Record<string, { long: number; short: number }> = {}
            Object.keys(mm).forEach(sym => { const m = mm[sym]; if (typeof m.long === 'number' && typeof m.short === 'number') nextRatio[sym] = { long: m.long, short: m.short } })
            if (Object.keys(nextRatio).length) setRatioMap(prev => ({ ...prev, ...nextRatio }))
          }
        } else if (exchange === 'Bybit') {
          const { url, headers } = prox('op=bundle&ex=bybit&topN=10')
          const r = await fetch(url, { headers }); if (!r.ok) throw new Error('Bybit bundle')
          const j = await r.json(); const parsed: Row[] = (j?.rows || [])
          if (mounted) setRows(parsed)
          const mm = j?.metrics || {}
          if (mm && Object.keys(mm).length) {
            setRows(prev => prev.map(x => {
              const m = mm[x.symbol]; if (!m) return x
              const add: Partial<Row> = {}
              if (typeof m.funding === 'number') add.funding = m.funding
              if (typeof m.oi === 'number') add.oi = m.oi // Bybit already value in quote currency
              return { ...x, ...add }
            }))
          }
        } else if (exchange === 'OKX') {
          const { url, headers } = prox('op=bundle&ex=okx&topN=10')
          const r = await fetch(url, { headers }); if (!r.ok) throw new Error('OKX bundle')
          const j = await r.json(); const parsed: Row[] = (j?.rows || [])
          if (mounted) setRows(parsed)
          const mm = j?.metrics || {}
          if (mm && Object.keys(mm).length) {
            setRows(prev => prev.map(x => {
              const m = mm[x.symbol]; if (!m) return x
              const add: Partial<Row> = {}
              if (typeof m.funding === 'number') add.funding = m.funding
              if (typeof m.oi === 'number') add.oi = m.oi
              return { ...x, ...add }
            }))
          }
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'error')
      } finally {
        setLoading(false); timer = setTimeout(pull, nextMs)
      }
    }
    pull(); return () => { mounted = false; if (timer) clearTimeout(timer) }
  }, [exchange, prox])

  // No extra metrics effect needed; binance bundle already returns metrics

  // Filter + sort
  const filteredSorted = React.useMemo(() => {
    let list = rows
    if (typeFilter !== 'ALL') list = list.filter(r => r.contractType === typeFilter)
    if (query.trim()) list = list.filter(r => r.symbol.toLowerCase().includes(query.trim().toLowerCase()))
    const dir = sortDir === 'asc' ? 1 : -1
    list = [...list].sort((a, b) => ((a[sortBy] ?? -Infinity) - (b[sortBy] ?? -Infinity)) * dir)
    return list
  }, [rows, query, typeFilter, sortBy, sortDir])

  // Infinite scroll sentinel
  React.useEffect(() => {
    const el = sentinelRef.current; if (!el) return
    const io = new IntersectionObserver((e) => { if (e.some(x => x.isIntersecting)) setVisibleCount(c => Math.min(c + PAGE_SIZE, Math.min(TOP_LIMIT, filteredSorted.length))) })
    io.observe(el); return () => io.disconnect()
  }, [filteredSorted.length])

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>선물 마켓</CardTitle>
              <CardDescription>부하 최적화된 실시간 선물 지표</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select value={exchange} onChange={e => setExchange(e.target.value as any)} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm">
                <option>Binance</option>
                <option>Bybit</option>
                <option>OKX</option>
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm">
                <option value="volume">거래량(24h)</option>
                <option value="funding">펀딩비</option>
                <option value="oi">미결제약정(OI)</option>
                <option value="change24h">24h 변동률</option>
              </select>
              <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] hover:bg-[#1e1e1e] text-sm">{sortDir === 'desc' ? '내림차순' : '오름차순'}</button>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrency('USD')} className={`px-2 py-1 rounded border border-neutral-700 text-sm ${currency === 'USD' ? 'bg-emerald-600/20 text-emerald-300' : 'bg-[#1a1a1a]'}`}>USD</button>
                <button onClick={() => setCurrency('KRW')} className={`px-2 py-1 rounded border border-neutral-700 text-sm ${currency === 'KRW' ? 'bg-emerald-600/20 text-emerald-300' : 'bg-[#1a1a1a]'}`}>KRW</button>
              </div>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm">
                <option value="ALL">전체</option>
                <option value="PERP">Perp</option>
                <option value="FUTURES">분기물</option>
              </select>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="심볼 검색 (예: BTCUSDT)" className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm flex-1 min-w-[160px]" />
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
                  <th className="px-3 py-2 text-right hidden sm:table-cell">미결제약정</th>
                  <th className="px-3 py-2 text-right hidden md:table-cell">롱/숏</th>
                  <th className="px-3 py-2 text-right">거래량(24h)</th>
                </tr>
              </thead>
              <tbody>
                {filteredSorted.slice(0, TOP_LIMIT).slice(0, visibleCount).map(r => {
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
          {visibleCount < Math.min(TOP_LIMIT, filteredSorted.length) && (
            <div className="mt-2 flex justify-center">
              <button onClick={() => setVisibleCount(c => Math.min(c + PAGE_SIZE, Math.min(TOP_LIMIT, filteredSorted.length)))} className="px-3 py-1 rounded border border-neutral-700 bg-[#1a1a1a] hover:bg-[#1e1e1e] text-sm">더 보기</button>
            </div>
          )}
          {loading && <div className="text-xs text-muted-foreground mt-2">업데이트 중...</div>}
        </CardContent>
      </Card>
    </section>
  )
}

function RatioBar({ longPct, shortPct }: { longPct?: number; shortPct?: number }) {
  const lp = Math.max(0, Math.min(100, longPct ?? 50))
  const sp = Math.max(0, Math.min(100, shortPct ?? 50))
  const total = lp + sp || 100
  const lw = Math.round((lp / total) * 100)
  const sw = 100 - lw
  return (
    <div className="inline-flex items-center gap-2 justify-end" title={`Long ${lp.toFixed(1)}% / Short ${sp.toFixed(1)}%`}>
      <div className="w-32 h-2.5 rounded bg-neutral-800 overflow-hidden grid" style={{ gridTemplateColumns: `${lw}% ${sw}%` }}>
        <div className="bg-emerald-500" />
        <div className="bg-red-500" />
      </div>
      <span className="text-xs text-muted-foreground">L {lp.toFixed(0)}% / S {sp.toFixed(0)}%</span>
    </div>
  )
}

function num(v: any): number | undefined { const n = Number(v); return Number.isFinite(n) ? n : undefined }
function percent(v?: number | string) { const n = Number(v); if (!Number.isFinite(n)) return undefined; return Math.abs(n) <= 1 ? n * 100 : n }
function fmtPct(v?: number) { if (!Number.isFinite(v as number)) return '--'; const n = v as number; return `${n > 0 ? '+' : ''}${n.toFixed(2)}%` }
function pctClass(v?: number) { if (!Number.isFinite(v as number)) return 'text-muted-foreground'; return (v as number) >= 0 ? 'text-emerald-400' : 'text-red-400' }
function convert(value?: number, currency: 'USD' | 'KRW' = 'USD', usdkrw = 0) { if (!Number.isFinite(value as number)) return undefined; if (currency === 'USD') return value; if (usdkrw > 0) return (value as number) * usdkrw; return undefined }
function formatCurrency(v?: number, currency: 'USD' | 'KRW' = 'USD') { if (!Number.isFinite(v as number)) return '--'; return currency === 'USD' ? `$${(v as number).toLocaleString('en-US')}` : `${Math.round(v as number).toLocaleString('ko-KR')}원` }
