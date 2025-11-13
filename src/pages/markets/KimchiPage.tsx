import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'

type Row = {
  symbol: string
  domestic: number | undefined // KRW
  foreignUsd: number | undefined // USD
  foreignKrw: number | undefined // KRW (converted)
  premium: number | undefined // %
  spread: number | undefined // KRW
}

const TARGET = [
  'BTC','ETH','XRP','SOL','DOGE','ADA','AVAX','DOT','LINK','MATIC','TON','APT','ARB','OP','SUI','LTC','BCH','TRX','NEAR','ATOM'
]

type Domestic = 'Upbit'|'Bithumb'|'Coinone'
type Overseas = 'Binance'|'Bybit'|'OKX'

export default function KimchiPage() {
  // UI state with localStorage
  const uiKey = 'kimchi_ui_v1'
  const uiInit = React.useMemo(() => { try { return JSON.parse(localStorage.getItem(uiKey) || 'null') || {} } catch { return {} } }, [])
  const [dom, setDom] = React.useState<Domestic>(uiInit.dom || 'Upbit')
  const [ovr, setOvr] = React.useState<Overseas>(uiInit.ovr || 'Binance')
  const [usdkrw, setUsdkrw] = React.useState<number>(0)
  const [rows, setRows] = React.useState<Row[]>([])
  const [symbols, setSymbols] = React.useState<string[]>([])
  const [query, setQuery] = React.useState(uiInit.query || '')
  const [sort, setSort] = React.useState<'premium'|'spread'|'domestic'|'foreign'>(uiInit.sort || 'premium')
  const [dir, setDir] = React.useState<'desc'|'asc'>(uiInit.dir || 'desc')
  const [basis, setBasis] = React.useState<'foreign'|'domestic'>(uiInit.basis || 'foreign') // premium denominator
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string| null>(null)
  const reloadRef = React.useRef<() => void>(() => {})

  // persist UI state
  React.useEffect(() => {
    try { localStorage.setItem(uiKey, JSON.stringify({ dom, ovr, query, sort, dir, basis })) } catch {}
  }, [dom, ovr, query, sort, dir, basis])

  // USD->KRW 환율 (캐시 + 백그라운드 갱신)
  React.useEffect(() => {
    let mounted = true
    const key = 'usdkrw_cache_v1'
    try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c && typeof c.rate==='number') setUsdkrw(c.rate) } catch {}
    let delay = 0
    const pull = async () => {
      try {
        // try multiple FX sources
        let rate: number | undefined
        const tryFetchers = [
          async () => { const r = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=KRW'); if (!r.ok) throw new Error('exchangerate.host'); const j = await r.json(); return j?.rates?.KRW },
          async () => { const r = await fetch('https://open.er-api.com/v6/latest/USD'); if (!r.ok) throw new Error('open.er-api'); const j = await r.json(); return j?.rates?.KRW },
          async () => { const r = await fetch('https://cdn.jsdelivr.net/gh/fawazahmed0/exchange-api@1/latest/currencies/usd/krw.json'); if (!r.ok) throw new Error('jsdelivr'); const j = await r.json(); return j?.krw }
        ]
        for (const fn of tryFetchers) { try { const v = await fn(); if (typeof v === 'number' && v>0) { rate = v; break } } catch {} }
        if (mounted && typeof rate === 'number') { setUsdkrw(rate); try { localStorage.setItem(key, JSON.stringify({ rate, ts: Date.now() })) } catch {}; delay = 6*60*60*1000 }
      } catch { delay = Math.min(delay?delay*2:60_000, 5*60*1000) } finally { if (mounted) setTimeout(pull, delay || 60_000) }
    }
    pull();
    return () => { mounted = false }
  }, [])

  // Build symbols dynamically from selected exchanges (intersection)
  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [ds, os] = await Promise.all([
          listDomesticSymbols(dom),
          listOverseasSymbols(ovr),
        ])
        const setD = new Set(ds)
        const inter: string[] = []
        for (const s of os) if (setD.has(s)) inter.push(s)
        const list = inter.length ? inter : TARGET
        if (mounted) setSymbols(list.slice(0, 100))
      } catch { if (mounted) setSymbols(TARGET) }
    })()
    return () => { mounted = false }
  }, [dom, ovr])

  // Fetch both sides and build rows
  React.useEffect(() => {
    let mounted = true
    let timer: any
    const pull = async () => {
      try {
        setLoading(true); setError(null)
        const symbolsUse = symbols.length ? symbols : TARGET
        const [domMap, ovrMap] = await Promise.all([
          fetchDomestic(dom, symbolsUse),
          fetchOverseas(ovr, symbolsUse),
        ])
        const out: Row[] = symbolsUse.map(sym => {
          const domestic = domMap.get(sym)
          const foreignUsd = ovrMap.get(sym)
          const foreignKrw = convert(foreignUsd, 'KRW', usdkrw)
          const premium = computePremium(domestic, foreignKrw, basis)
          const spread = computeSpread(domestic, foreignKrw)
          return { symbol: sym, domestic, foreignUsd, foreignKrw, premium, spread }
        })
        if (mounted) setRows(out)
      } catch (e: any) {
        if (mounted) setError(e?.message || 'API 오류')
      } finally {
        if (mounted) setLoading(false)
        timer = setTimeout(pull, 30_000)
      }
    }
    pull()
    reloadRef.current = pull
    return () => { mounted = false; if (timer) clearTimeout(timer) }
  }, [dom, ovr, usdkrw, symbols, basis])

  const displayed = React.useMemo(() => {
    let list = rows
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(r => r.symbol.toLowerCase().includes(q))
    }
    const d = dir==='asc'?1:-1
    const k = sort
    list = [...list].sort((a,b) => (((a as any)[k] ?? -Infinity) - ((b as any)[k] ?? -Infinity)) * d)
    return list
  }, [rows, query, sort, dir])

  const btc = rows.find(r=>r.symbol==='BTC')
  const eth = rows.find(r=>r.symbol==='ETH')

  return (
    <section className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>김치 프리미엄</CardTitle>
            <CardDescription>국내/해외 가격 차</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-semibold ${pctClass(btc?.premium)}`}>{fmtPct(btc?.premium)}</div>
            <div className="mt-2 text-sm text-muted-foreground">BTC 기준 스프레드 {fmtKRW(btc?.spread)} (국내 {fmtKRW(btc?.domestic)} · 해외 {fmtKRW(btc?.foreignKrw)})</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>ETH 김프</CardTitle>
            <CardDescription>ETH 기준 비교</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-semibold ${pctClass(eth?.premium)}`}>{fmtPct(eth?.premium)}</div>
            <div className="mt-2 text-sm text-muted-foreground">스프레드 {fmtKRW(eth?.spread)} (국내 {fmtKRW(eth?.domestic)} · 해외 {fmtKRW(eth?.foreignKrw)})</div>
          </CardContent>
        </Card>
      </div>

      {/* 컨트롤 + 표 */}
      <Card className="bg-[#121212] border-neutral-800">
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm text-muted-foreground">국내 거래소</div>
            <select value={dom} onChange={(e)=>setDom(e.target.value as Domestic)} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm">
              <option>Upbit</option>
              <option>Bithumb</option>
              <option>Coinone</option>
            </select>
            <div className="ml-2 text-sm text-muted-foreground">해외 거래소</div>
            <select value={ovr} onChange={(e)=>setOvr(e.target.value as Overseas)} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm">
              <option>Binance</option>
              <option>Bybit</option>
              <option>OKX</option>
            </select>
            <div className="ml-2 text-sm text-muted-foreground">기준</div>
            <select value={basis} onChange={(e)=>setBasis(e.target.value as any)} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm">
              <option value="foreign">해외 기준 (국내/해외 - 1)</option>
              <option value="domestic">국내 기준 (해외/국내 - 1)</option>
            </select>
            <div className="ml-auto flex items-center gap-2">
              <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="심볼 검색 (예: BTC)" className="px-3 py-1.5 rounded border border-neutral-700 bg-[#1a1a1a] text-sm" />
              <select value={sort} onChange={(e)=>setSort(e.target.value as any)} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm">
                <option value="premium">프리미엄(%)</option>
                <option value="spread">스프레드(KRW)</option>
                <option value="domestic">국내가격</option>
                <option value="foreign">해외가격</option>
              </select>
              <button onClick={()=>setDir(d=>d==='asc'?'desc':'asc')} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] hover:bg-[#1e1e1e] text-sm">{dir==='desc'?'내림차순':'오름차순'}</button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-xs text-amber-300 mb-2 flex items-center gap-2">
              <span>API 오류: {error}</span>
              <button onClick={()=>reloadRef.current()} className="px-2 py-0.5 rounded border border-amber-600 text-amber-300 hover:bg-amber-600/10">다시 시도</button>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">심볼</th>
                  <th className="px-3 py-2 text-right font-medium">국내 가격 (KRW)</th>
                  <th className="px-3 py-2 text-right font-medium">해외 가격 (KRW)</th>
                  <th className="px-3 py-2 text-right font-medium">프리미엄</th>
                  <th className="px-3 py-2 text-right font-medium">스프레드</th>
                  <th className="px-3 py-2 text-right font-medium">거래소</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length===0 ? (
                  Array.from({length:10},(_,i)=>(
                    <tr key={`sk-${i}`} className="border-t border-border">
                      <td className="px-3 py-2"><div className="h-4 w-16 bg-neutral-800 rounded" /></td>
                      <td className="px-3 py-2 text-right"><div className="h-4 w-24 bg-neutral-800 rounded ml-auto" /></td>
                      <td className="px-3 py-2 text-right"><div className="h-4 w-24 bg-neutral-800 rounded ml-auto" /></td>
                      <td className="px-3 py-2 text-right"><div className="h-4 w-14 bg-neutral-800 rounded ml-auto" /></td>
                      <td className="px-3 py-2 text-right"><div className="h-4 w-20 bg-neutral-800 rounded ml-auto" /></td>
                      <td className="px-3 py-2 text-right"><div className="h-4 w-20 bg-neutral-800 rounded ml-auto" /></td>
                    </tr>
                  ))
                ) : null}
                {displayed.map(r => (
                  <tr key={`${dom}-${ovr}-${r.symbol}`} className="border-t border-border hover:bg-accent/20 transition-colors">
                    <td className="px-3 py-2 font-medium">{r.symbol}</td>
                    <td className="px-3 py-2 text-right">{fmtKRW(r.domestic)}</td>
                    <td className="px-3 py-2 text-right">{fmtKRW(r.foreignKrw)}</td>
                    <td className={`px-3 py-2 text-right ${pctClass(r.premium)}`}>{fmtPct(r.premium)}</td>
                    <td className={`px-3 py-2 text-right ${Number(r.spread)>=0?'text-emerald-400':'text-red-400'}`}>{fmtKRW(r.spread)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{dom} / {ovr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading ? <div className="text-xs text-muted-foreground mt-2">업데이트 중...</div> : null}
        </CardContent>
      </Card>
    </section>
  )
}

// ============ Helpers & Fetchers ============
function num(v: any): number | undefined { const n = Number(v); return Number.isFinite(n) ? n : undefined }
function convert(value?: number, currency: 'USD'|'KRW' = 'USD', usdkrw = 0) {
  if (!Number.isFinite(value as number)) return undefined
  if (currency === 'KRW') return (value as number) * usdkrw
  return value
}
function computePremium(domestic?: number, foreignKrw?: number, basis: 'foreign'|'domestic' = 'foreign') {
  if (!Number.isFinite(domestic as number) || !Number.isFinite(foreignKrw as number)) return undefined
  const d = domestic as number
  const f = foreignKrw as number
  if (basis === 'domestic') {
    if (d === 0) return undefined
    return ((f - d) / d) * 100
  }
  if (f === 0) return undefined
  return ((d - f) / f) * 100
}
function computeSpread(domestic?: number, foreignKrw?: number) {
  if (!Number.isFinite(domestic as number) || !Number.isFinite(foreignKrw as number)) return undefined
  return (domestic as number) - (foreignKrw as number)
}
function fmtPct(v?: number) { if (!Number.isFinite(v as number)) return '--'; const n=v as number; return `${n>0?'+':''}${n.toFixed(2)}%` }
function fmtKRW(v?: number) { if (!Number.isFinite(v as number)) return '--'; return `${Math.round(v as number).toLocaleString('ko-KR')}원` }
function pctClass(v?: number) { if (!Number.isFinite(v as number)) return 'text-muted-foreground'; return (v as number)>=0 ? 'text-emerald-400' : 'text-red-400' }

async function fetchDomestic(exchange: Domestic, symbols: string[]): Promise<Map<string, number|undefined>> {
  try {
    if (exchange === 'Upbit') {
      const markets = symbols.map(s=>`KRW-${s}`).join(',')
      const r = await fetch(`https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(markets)}`)
      if (!r.ok) throw new Error('Upbit 오류')
      const j = await r.json()
      const m = new Map<string, number>()
      for (const it of j) { const sym = String(it.market||'').replace('KRW-',''); const p = num(it.trade_price); if (sym && p) m.set(sym, p) }
      return m
    }
    if (exchange === 'Bithumb') {
      const r = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW')
      if (!r.ok) throw new Error('Bithumb 오류')
      const j = await r.json(); const data = j?.data || {}
      const m = new Map<string, number>()
      for (const s of symbols) { const it = data?.[s]; const p = num(it?.closing_price); if (p) m.set(s, p) }
      return m
    }
    // Coinone
    const r = await fetch('https://api.coinone.co.kr/public/v2/ticker?currency=all')
    if (!r.ok) throw new Error('Coinone 오류')
    const j = await r.json(); const t = j?.tickers || {}
    const m = new Map<string, number>()
    for (const s of symbols) { const it = t?.[s.toLowerCase()]; const p = num(it?.last); if (p) m.set(s, p) }
    return m
  } catch {
    return new Map()
  }
}

async function fetchOverseas(exchange: Overseas, symbols: string[]): Promise<Map<string, number|undefined>> {
  try {
    if (exchange === 'Binance') {
      const arr = symbols.map(s=>`${s}USDT`)
      const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(arr))}`)
      if (!r.ok) throw new Error('Binance 오류')
      const j = await r.json(); const m = new Map<string, number>()
      for (const it of j) { const sym = String(it.symbol||'').replace('USDT',''); const p = num(it.price); if (sym && p) m.set(sym, p) }
      return m
    }
    if (exchange === 'Bybit') {
      const r = await fetch('https://api.bybit.com/v5/market/tickers?category=spot')
      if (!r.ok) throw new Error('Bybit 오류')
      const j = await r.json(); const list: any[] = j?.result?.list || []
      const m = new Map<string, number>()
      for (const it of list) { const s = String(it.symbol||''); if (s.endsWith('USDT')) { const sym = s.replace('USDT',''); const p = num(it.lastPrice); if (sym && p) m.set(sym, p) } }
      const out = new Map<string, number>()
      for (const s of symbols) if (m.has(s)) out.set(s, m.get(s)!)
      return out
    }
    // OKX
    const r = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT')
    if (!r.ok) throw new Error('OKX 오류')
    const j = await r.json(); const list: any[] = j?.data || []
    const m = new Map<string, number>()
    for (const it of list) { const id = String(it.instId||''); if (id.endsWith('-USDT')) { const sym = id.replace('-USDT',''); const p = num(it.last); if (sym && p) m.set(sym, p) } }
    const out = new Map<string, number>()
    for (const s of symbols) if (m.has(s)) out.set(s, m.get(s)!)
    return out
  } catch {
    return new Map()
  }
}

// symbol list helpers
async function listDomesticSymbols(exchange: Domestic): Promise<string[]> {
  try {
    if (exchange === 'Upbit') {
      const r = await fetch('https://api.upbit.com/v1/market/all?isDetails=false')
      if (!r.ok) throw new Error('Upbit list')
      const j = await r.json()
      return j.filter((it: any)=>String(it.market||'').startsWith('KRW-')).map((it:any)=>String(it.market).replace('KRW-',''))
    }
    if (exchange === 'Bithumb') {
      const r = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW')
      if (!r.ok) throw new Error('Bithumb list')
      const j = await r.json(); const data = j?.data || {}
      return Object.keys(data).filter(k=>k && k.toUpperCase()===k && k.length<=8)
    }
    const r = await fetch('https://api.coinone.co.kr/public/v2/ticker?currency=all')
    if (!r.ok) throw new Error('Coinone list')
    const j = await r.json(); const t = j?.tickers || {}
    return Object.keys(t).map(k=>k.toUpperCase())
  } catch { return TARGET }
}

async function listOverseasSymbols(exchange: Overseas): Promise<string[]> {
  try {
    if (exchange === 'Binance') {
      const r = await fetch('https://api.binance.com/api/v3/exchangeInfo')
      if (!r.ok) throw new Error('Binance list')
      const j = await r.json(); const syms: string[] = []
      for (const s of (j?.symbols||[])) { if (s.quoteAsset==='USDT' && s.status==='TRADING') syms.push(String(s.baseAsset)) }
      return syms
    }
    if (exchange === 'Bybit') {
      const r = await fetch('https://api.bybit.com/v5/market/tickers?category=spot')
      if (!r.ok) throw new Error('Bybit list')
      const j = await r.json(); const list: any[] = j?.result?.list || []
      return list.map(it=>String(it.symbol||'')).filter(s=>s.endsWith('USDT')).map(s=>s.replace('USDT',''))
    }
    const r = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT')
    if (!r.ok) throw new Error('OKX list')
    const j = await r.json(); const list: any[] = j?.data || []
    return list.map(it=>String(it.instId||'')).filter(id=>id.endsWith('-USDT')).map(id=>id.replace('-USDT',''))
  } catch { return TARGET }
}
