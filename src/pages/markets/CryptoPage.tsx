import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'

type Coin = {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  market_cap_rank?: number
  market_cap: number
  total_volume: number
  price_change_percentage_24h?: number
  price_change_percentage_7d_in_currency?: number
  sparkline_in_7d?: { price: number[] }
  high_24h?: number
  low_24h?: number
}

export default function CryptoPage() {
  const [currency, setCurrency] = React.useState<'USD'|'KRW'>('USD')
  const [usdkrw, setUsdkrw] = React.useState<number>(0)
  React.useEffect(() => {
    if (currency !== 'KRW') return
    let mounted = true
    const cacheKey = 'usdkrw_cache_v1'
    // warm from cache regardless of age so 화면이 빈 상태가 되지 않음
    try { const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null'); if (cached && typeof cached.rate === 'number') setUsdkrw(cached.rate) } catch {}
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
        // backoff but keep 화면 내용 그대로
        delay = Math.min(delay ? delay*2 : 60_000, 5*60*1000)
      } finally {
        if (mounted) setTimeout(pull, delay || 60_000)
      }
    }
    pull()
    return () => { mounted = false }
  }, [currency])

  const [coins, setCoins] = React.useState<Coin[]>([])
  const [query, setQuery] = React.useState('')
  const [sort, setSort] = React.useState<{ key: string; dir: 'asc'|'desc' }>({ key: 'market_cap', dir: 'desc' })
  const [fav, setFav] = React.useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem('fav_coins') || '{}') } catch { return {} } })
  const [category, setCategory] = React.useState<'ALL'|'BTC'|'ETH'|'ALTS'|'FAV'>('ALL')

  // Coin list: cache + backoff. 실패해도 기존 화면 유지
  const [status, setStatus] = React.useState<'idle'|'loading'|'ok'|'rate_limited'>('idle')
  const [nextAt, setNextAt] = React.useState<number | null>(null)
  const [remain, setRemain] = React.useState<number>(0)
  React.useEffect(() => {
    try { if (!(window.location?.pathname || '').startsWith('/markets')) return } catch {}
    let mounted = true
    let timer: any
    const cacheKey = 'cg_markets_cache_v1'
    // warm cache first so UI not empty
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null')
      if (cached && Array.isArray(cached.data)) setCoins(cached.data)
    } catch {}
    let delay = 0
    const pull = async () => {
      try {
        setStatus('loading')
        const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=24h,7d'
        const res = await fetch(url)
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        if (mounted && Array.isArray(data)) {
          setCoins(data)
          setStatus('ok')
          try { localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() })) } catch {}
          delay = 60_000
        }
      } catch {
        // keep previous coins, mark rate limited, schedule backoff
        setStatus('rate_limited')
        delay = Math.min(delay ? delay*2 : 30_000, 5*60*1000)
      } finally {
        if (mounted) {
          setNextAt(Date.now() + (delay || 60_000))
          timer = setTimeout(pull, delay || 60_000)
        }
      }
    }
    pull()
    return () => { mounted = false; if (timer) clearTimeout(timer) }
  }, [])

  // countdown for UI hint (optional)
  React.useEffect(() => {
    if (!nextAt) return
    const int = setInterval(() => {
      setRemain(Math.max(0, Math.ceil((nextAt - Date.now())/1000)))
    }, 1000)
    return () => clearInterval(int)
  }, [nextAt])

  const [page, setPage] = React.useState(1)
  const pageSize = 25

  const displayedRaw = React.useMemo(() => {
    let list = coins
    if (category !== 'ALL') {
      if (category === 'BTC') list = list.filter(c => c.symbol?.toLowerCase() === 'btc' || c.id === 'bitcoin')
      else if (category === 'ETH') list = list.filter(c => c.symbol?.toLowerCase() === 'eth' || c.id === 'ethereum')
      else if (category === 'ALTS') list = list.filter(c => !['btc','eth'].includes(c.symbol?.toLowerCase()))
      else if (category === 'FAV') list = list.filter(c => fav[c.id])
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q))
    }
    const dir = sort.dir === 'asc' ? 1 : -1
    list = [...list].sort((a,b) => {
      const k = sort.key as keyof Coin
      const av: any = (a as any)[k] ?? 0
      const bv: any = (b as any)[k] ?? 0
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
    return list
  }, [coins, query, sort, category, fav])

  const displayed = React.useMemo(() => { const start = (page - 1) * pageSize; return displayedRaw.slice(start, start + pageSize) }, [displayedRaw, page])

  // Detail popover (anchored near the clicked row; prefer below)
  const [detail, setDetail] = React.useState<Coin | null>(null)
  const [anchor, setAnchor] = React.useState<{ top: number; left: number; width: number } | null>(null)
  // Fav click pulse animation state (per coin id)
  const [favPulse, setFavPulse] = React.useState<Record<string, boolean>>({})
  const handleFavClick = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation()
    setFav(prev => {
      const nx = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem('fav_coins', JSON.stringify(nx)) } catch {}
      return nx
    })
    setFavPulse((p) => ({ ...p, [id]: true }))
    setTimeout(() => {
      setFavPulse((p) => { const nx = { ...p }; delete nx[id]; return nx })
    }, 220)
  }
  const openDetail = (e: React.MouseEvent<HTMLTableRowElement>, coin: Coin) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const margin = 8
    // Prefer a panel below the row, aligned to the row's left, clamped to viewport
    const desiredWidth = Math.min(Math.max(rect.width, 280), 520)
    const maxLeft = window.scrollX + window.innerWidth - margin - desiredWidth
    let left = Math.min(Math.max(rect.left + window.scrollX, window.scrollX + margin), maxLeft)
    let top = rect.bottom + window.scrollY + margin
    const viewportBottom = window.scrollY + window.innerHeight - margin
    const estimatedHeight = 260
    // If not enough space below, show above the row
    if (top + estimatedHeight > viewportBottom) {
      top = Math.max(window.scrollY + margin, rect.top + window.scrollY - estimatedHeight - margin)
    }
    setAnchor({ top, left, width: desiredWidth })
    setDetail(coin)
  }

  return (
    <section className="space-y-4">
      {/* Controls */}
      {/* Mobile-only: compact search + buttons row */}
      <div className="flex items-center gap-1 px-3 w-full sm:hidden">
        <div className="w-[45%] min-w-0 flex-none">
          <input
            value={query}
            onChange={(e)=>{ setQuery(e.target.value); setPage(1) }}
            placeholder="코인 검색 (예: btc, eth)"
            className="px-2 py-2 rounded-lg bg-[#1a1a1a] border border-neutral-700 text-sm w-full"
          />
        </div>
        <div className="flex items-center gap-1 w-[55%] justify-end flex-nowrap flex-none">
          <button onClick={()=>setCurrency('USD')} className={`px-2 py-1 rounded border border-neutral-700 text-xs whitespace-nowrap shrink-0 ${currency==='USD'?'bg-emerald-600/20 text-emerald-300':'bg-[#1a1a1a] hover:bg-[#1e1e1e]'}`}>USD</button>
          <button onClick={()=>setCurrency('KRW')} className={`px-2 py-1 rounded border border-neutral-700 text-xs whitespace-nowrap shrink-0 ${currency==='KRW'?'bg-emerald-600/20 text-emerald-300':'bg-[#1a1a1a] hover:bg-[#1e1e1e]'}`}>KRW</button>
          <button onClick={()=>{setCategory('FAV'); setPage(1)}} className={`px-2 py-1 rounded border border-neutral-700 text-xs whitespace-nowrap shrink-0 ${category==='FAV'?'bg-emerald-600/20 text-emerald-300':'bg-[#1a1a1a] hover:bg-[#1e1e1e]'}`}>즐겨찾기</button>
        </div>
      </div>
      <div className="hidden sm:flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1"></div>
        <input value={query} onChange={(e)=>{ setQuery(e.target.value); setPage(1) }} placeholder="코인 검색 (예: btc, eth)" className="px-3 py-2 rounded border border-neutral-700 bg-[#1a1a1a] focus:outline-none w-full sm:w-auto" />
        <div className="ml-auto flex items-center gap-1">
          <button onClick={()=>setCurrency('USD')} className={`px-2 py-1 rounded border border-neutral-700 ${currency==='USD'?'bg-emerald-600/20 text-emerald-300':'bg-[#1a1a1a] hover:bg-[#1e1e1e]'}`}>USD</button>
          <button onClick={()=>setCurrency('KRW')} className={`px-2 py-1 rounded border border-neutral-700 ${currency==='KRW'?'bg-emerald-600/20 text-emerald-300':'bg-[#1a1a1a] hover:bg-[#1e1e1e]'}`}>KRW</button>
          <button onClick={()=>{setCategory('FAV'); setPage(1)}} className={`px-2 py-1 rounded border border-neutral-700 text-sm ${category==='FAV'?'bg-emerald-600/20 text-emerald-300':'bg-[#1a1a1a] hover:bg-[#1e1e1e]'}`}>즐겨찾기</button>
        </div>
      </div>
      {false && status==='rate_limited' && (
        <div className="text-xs text-amber-300">API rate limit: {remain}s 후 재시도 중 (화면은 마지막 데이터 유지)</div>
      )}

      {/* Coin table */}
      <Card className="bg-[#121212] border-neutral-800">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-white">주요 코인</CardTitle>
              <CardDescription>시가총액 상위 · 실시간 가격</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">정렬:</span>
              {[
                { key:'market_cap', label:'시총' },
                { key:'total_volume', label:'거래대금' },
                { key:'price_change_percentage_24h', label:'24h%' },
              ].map(c => (
                <button key={c.key} onClick={()=> setSort(s=>({ key: c.key, dir: s.key===c.key && s.dir==='desc' ? 'asc' : 'desc' }))} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] hover:bg-[#1e1e1e] text-sm">{c.label}</button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <table className="min-w-full text-[13px] sm:text-sm">
              <thead>
                <tr className="text-gray-400">
                  {[
                    { key:'market_cap_rank', label:'#' },
                    { key:'fav', label:'★' },
                    { key:'name', label:'코인' },
                    { key:'current_price', label:'가격' },
                    { key:'price_change_percentage_24h', label:'24h%' },
                    { key:'price_change_percentage_7d_in_currency', label:'7d%' },
                    { key:'total_volume', label:'거래대금' },
                    { key:'market_cap', label:'시가총액' },
                    { key:'spark', label:'7d' },
                  ].map((c) => (
                    <th key={c.key} className="px-3 py-2 text-left select-none">
                      <button onClick={()=> setSort(s=>({ key: c.key==='spark'?'market_cap':c.key, dir: s.key===c.key && s.dir==='desc' ? 'asc' : 'desc' }))} className="hover:text-white">{c.label}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((c) => (
                  <tr key={c.id} className="border-t border-neutral-800 hover:bg-[#1e1e1e] cursor-pointer" onClick={(e)=>openDetail(e, c)}>
                    <td className="px-3 py-2">{(c as any).market_cap_rank || '-'}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={(e)=>handleFavClick(e, c.id)}
                        className={`inline-flex items-center justify-center p-0.5 rounded-full text-sm hover:text-yellow-400 transform transition duration-200 ${favPulse[c.id] ? 'scale-125 ring-2 ring-yellow-400' : ''} ${fav[c.id] ? 'text-yellow-400' : 'text-gray-500'}`}
                        style={favPulse[c.id] ? { filter: 'drop-shadow(0 0 6px #facc15)' } : undefined}
                        aria-label="즐겨찾기"
                        aria-pressed={fav[c.id] ? true : false}
                      >
                        ★
                      </button>
                    </td>
                    <td className="px-3 py-2 flex items-center gap-2">
                      <img src={c.image} alt={c.name} className="w-5 h-5 rounded-full" />
                      <span className="text-white">{c.name}</span>
                      <span className="text-gray-400 uppercase">{c.symbol}</span>
                    </td>
                    <td className="px-3 py-2">{formatCurrency(convert(c.current_price, currency, usdkrw), currency)}</td>
                    <td className={`px-3 py-2 ${pctClass(c.price_change_percentage_24h)}`}>{fmtPct(c.price_change_percentage_24h)}</td>
                    <td className={`px-3 py-2 ${pctClass(c.price_change_percentage_7d_in_currency)}`}>{fmtPct(c.price_change_percentage_7d_in_currency)}</td>
                    <td className="px-3 py-2">{formatCurrency(convert(c.total_volume, currency, usdkrw), currency)}</td>
                    <td className="px-3 py-2">{formatCurrency(convert(c.market_cap, currency, usdkrw), currency)}</td>
                    <td className="px-3 py-2"><SparkLine data={c.sparkline_in_7d?.price || []} up={(c.price_change_percentage_7d_in_currency||0) >= 0} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] hover:bg-[#1e1e1e]">Prev</button>
            <span className="text-gray-400">Page {page} / {Math.max(1, Math.ceil(displayedRaw.length / pageSize))}</span>
            <button onClick={()=>setPage(p=>Math.min(Math.ceil(displayedRaw.length / pageSize), p+1))} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] hover:bg-[#1e1e1e]">Next</button>
          </div>
        </CardContent>
      </Card>

      {/* Detail popover: mobile bottom sheet, desktop anchored */}
      {detail && (
        <div className="fixed inset-0 z-50" onClick={()=>{ setDetail(null); setAnchor(null) }}>
          {/* Mobile bottom sheet */}
          <div
            className="sm:hidden absolute inset-x-0 bottom-0 rounded-t-2xl border border-neutral-800 bg-[#121212] p-4 shadow-xl max-h-[75vh] overflow-y-auto"
            onClick={(e)=>e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <img src={detail.image} alt={detail.name} className="w-6 h-6 rounded-full" />
                <div className="text-white font-semibold">{detail.name} <span className="uppercase text-gray-400 text-xs">{detail.symbol}</span></div>
              </div>
              <button onClick={()=>{ setDetail(null); setAnchor(null) }} className="px-2 py-1 rounded bg-[#1a1a1a] hover:bg-[#1e1e1e]">닫기</button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">현재가</span>
                <span className="text-white">{formatCurrency(convert(detail.current_price, currency, usdkrw), currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">24h 최고</span>
                <span className="text-emerald-400">{formatCurrency(convert(detail.high_24h, currency, usdkrw), currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">24h 최저</span>
                <span className="text-red-400">{formatCurrency(convert(detail.low_24h, currency, usdkrw), currency)}</span>
              </div>
            </div>
            <div className="mt-3">
              <SparkLine data={detail.sparkline_in_7d?.price || []} up={(detail.price_change_percentage_7d_in_currency||0)>=0} />
            </div>
          </div>

          {/* Desktop anchored popover */}
          {anchor && (
            <div
              className="hidden sm:block absolute rounded-xl border border-neutral-800 bg-[#121212] p-4 shadow-xl"
              style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
              onClick={(e)=>e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <img src={detail.image} alt={detail.name} className="w-6 h-6 rounded-full" />
                  <div className="text-white font-semibold">{detail.name} <span className="uppercase text-gray-400 text-xs">{detail.symbol}</span></div>
                </div>
                <button onClick={()=>{ setDetail(null); setAnchor(null) }} className="px-2 py-1 rounded bg-[#1a1a1a] hover:bg-[#1e1e1e]">닫기</button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">현재가</span>
                  <span className="text-white">{formatCurrency(convert(detail.current_price, currency, usdkrw), currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">24h 최고</span>
                  <span className="text-emerald-400">{formatCurrency(convert(detail.high_24h, currency, usdkrw), currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">24h 최저</span>
                  <span className="text-red-400">{formatCurrency(convert(detail.low_24h, currency, usdkrw), currency)}</span>
                </div>
              </div>
              <div className="mt-3">
                <SparkLine data={detail.sparkline_in_7d?.price || []} up={(detail.price_change_percentage_7d_in_currency||0)>=0} />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function pctClass(v?: number) {
  if (v === undefined || v === null || !Number.isFinite(v)) return 'text-gray-400'
  return v >= 0 ? 'text-emerald-400' : 'text-red-400'
}
function fmtPct(v?: number) {
  if (v === undefined || v === null || !Number.isFinite(v)) return '--'
  const s = v.toFixed(2) + '%'
  return (v>0?'+':'') + s
}
function convert(value?: number, currency: 'USD'|'KRW' = 'USD', usdkrw = 0) {
  if (!Number.isFinite(value as number)) return undefined
  if (currency === 'USD') return value
  if (usdkrw && usdkrw > 0) return (value as number) * usdkrw
  return undefined
}
function formatCurrency(v?: number, currency: 'USD'|'KRW' = 'USD') {
  if (!Number.isFinite(v as number)) return '--'
  return currency === 'USD' ? `$${(v as number).toLocaleString()}` : `₩${Math.round(v as number).toLocaleString()}`
}

function SparkLine({ data, up }: { data: number[]; up: boolean }) {
  if (!data || data.length === 0) return <div className="h-6 w-24 bg-neutral-800 rounded" />
  const w = 120, h = 36
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  const stroke = up ? '#34d399' : '#f87171'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline fill="none" stroke={stroke} strokeWidth="2" points={points} />
    </svg>
  )
}
