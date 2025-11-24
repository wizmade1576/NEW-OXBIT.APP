// ======================= [1/3] START =======================
import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import { useAuthStore } from '@/store/useAuthStore'

type Row = {
  symbol: string
  domestic: number | undefined
  foreignUsd: number | undefined
  foreignKrw: number | undefined
  premium: number | undefined
  spread: number | undefined
}

const TARGET = [
  'BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'ADA', 'AVAX', 'DOT', 'LINK', 'MATIC', 'TON',
  'APT', 'ARB', 'OP', 'SUI', 'LTC', 'BCH', 'TRX', 'NEAR', 'ATOM',
]

type Domestic = 'Upbit' | 'Bithumb' | 'Coinone'
type Overseas = 'Binance' | 'Bybit' | 'OKX'

export default function KimchiPage() {
  const uiKey = 'kimchi_ui_v1'
  const uiInit = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem(uiKey) || 'null') || {} }
    catch { return {} }
  }, [])

  const [dom, setDom] = React.useState<Domestic>(uiInit.dom || 'Upbit')
  const [ovr, setOvr] = React.useState<Overseas>(uiInit.ovr || 'Binance')
  const [usdkrw, setUsdkrw] = React.useState<number>(0)
  const [rows, setRows] = React.useState<Row[]>([])
  const [symbols, setSymbols] = React.useState<string[]>([])
  const [query, setQuery] = React.useState(uiInit.query || '')
  const [sort, setSort] = React.useState<'premium' | 'spread' | 'domestic' | 'foreign'>(uiInit.sort || 'premium')
  const [dir, setDir] = React.useState<'desc' | 'asc'>(uiInit.dir || 'desc')
  const [basis, setBasis] = React.useState<'foreign' | 'domestic'>(uiInit.basis || 'foreign')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const reloadRef = React.useRef<() => void>(() => {})
  const [showFilter, setShowFilter] = React.useState(false)

  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [showSignupModal, setShowSignupModal] = React.useState(false)
  React.useEffect(() => {
    if (user) return
    const id = window.setTimeout(() => setShowSignupModal(true), 30000)
    return () => clearTimeout(id)
  }, [user])

  React.useEffect(() => {
    try { localStorage.setItem(uiKey, JSON.stringify({ dom, ovr, query, sort, dir, basis })) } catch {}
  }, [dom, ovr, query, sort, dir, basis])

  // USD->KRW 환율
  React.useEffect(() => {
    try {
      if (!(window.location?.pathname || '').startsWith('/markets')) return
    } catch {}

    let mounted = true
    const key = 'usdkrw_cache_v1'
    try {
      const c = JSON.parse(localStorage.getItem(key) || 'null')
      if (c?.rate) setUsdkrw(c.rate)
    } catch {}

    let delay = 0
    const pull = async () => {
      try {
        let rate: number | undefined
        const sources = [
          async () => (await (await fetch('https://api.exchangerate.host/latest?base=USD&symbols=KRW')).json())?.rates?.KRW,
          async () => (await (await fetch('https://open.er-api.com/v6/latest/USD')).json())?.rates?.KRW,
          async () => (await (await fetch('https://cdn.jsdelivr.net/gh/fawazahmed0/exchange-api@1/latest/currencies/usd/krw.json')).json())?.krw,
        ]
        for (const src of sources) {
          try {
            const v = await src()
            if (v > 0) { rate = v; break }
          } catch {}
        }
        if (mounted && typeof rate === 'number') {
          setUsdkrw(rate)
          localStorage.setItem(key, JSON.stringify({ rate, ts: Date.now() }))
          delay = 6 * 60 * 60 * 1000
        }
      } catch {
        delay = Math.min(delay ? delay * 2 : 60_000, 5 * 60 * 1000)
      } finally {
        if (mounted) setTimeout(pull, delay || 60_000)
      }
    }
    pull()
    return () => { mounted = false }
  }, [])

  // 심볼 intersection
  React.useEffect(() => {
    try {
      if (!(window.location?.pathname || '').startsWith('/markets')) return
    } catch {}

    let mounted = true
    ;(async () => {
      try {
        const [ds, os] = await Promise.all([listDomesticSymbols(dom), listOverseasSymbols(ovr)])
        const setD = new Set(ds)
        const inter = os.filter((s) => setD.has(s))
        const list = inter.length ? inter : TARGET
        if (mounted) setSymbols(list.slice(0, 100))
      } catch {
        if (mounted) setSymbols(TARGET)
      }
    })()
    return () => { mounted = false }
  }, [dom, ovr])

  // 데이터 fetch
  React.useEffect(() => {
    try {
      if (!(window.location?.pathname || '').startsWith('/markets')) return
    } catch {}

    let mounted = true
    let timer: any
    const pull = async () => {
      try {
        setLoading(true); setError(null)
        const list = symbols.length ? symbols : TARGET
        const [domMap, ovrMap] = await Promise.all([
          fetchDomestic(dom, list),
          fetchOverseas(ovr, list),
        ])
        const out: Row[] = list.map((sym) => {
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
      list = list.filter((r) => r.symbol.toLowerCase().includes(q))
    }
    const d = dir === 'asc' ? 1 : -1
    const k = sort
    return [...list].sort((a, b) => (((a as any)[k] ?? -Infinity) - ((b as any)[k] ?? -Infinity)) * d)
  }, [rows, query, sort, dir])

  const btc = rows.find((r) => r.symbol === 'BTC')
  const eth = rows.find((r) => r.symbol === 'ETH')

  return (
    <section className="space-y-6">
      {!user && showSignupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-[#0e1424] p-6 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold text-white">회원가입 안내</h3>
            <p className="mb-6 text-sm text-muted-foreground">서비스를 계속 이용 하실려면 회원가입이 필요합니다.</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90" onClick={() => navigate('/signup')}>
                회원가입 하기
              </button>
              <button type="button" className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a2235]" onClick={() => navigate('/breaking')}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes kimchi-slide-up { from { transform: translateY(100%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .animate-kimchi-slide-up { animation: kimchi-slide-up 0.22s ease-out }
      `}</style>

      {/* --- 요약카드 2개(모바일 2열 컴팩트) --- */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="p-3 sm:p-6 text-sm sm:text-base">
            <CardTitle>김치 프리미엄</CardTitle>
            <CardDescription>국내/해외 가격 비교</CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="block sm:hidden space-y-1">
              <div className={`text-2xl font-semibold ${pctClass(btc?.premium)}`}>{fmtPct(btc?.premium)}</div>
              <div className="text-xs text-muted-foreground">BTC 스프레드 {fmtKRW(btc?.spread)}</div>
              <div className="text-xs text-neutral-300">국내 {fmtKRW(btc?.domestic)}</div>
              <div className="text-xs text-neutral-300">해외 {fmtKRW(btc?.foreignKrw)}</div>
            </div>
            <div className="hidden sm:block">
              <div className={`text-3xl font-semibold ${pctClass(btc?.premium)}`}>{fmtPct(btc?.premium)}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                BTC 스프레드 {fmtKRW(btc?.spread)} (국내 {fmtKRW(btc?.domestic)} · 해외 {fmtKRW(btc?.foreignKrw)})
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 sm:p-6 text-sm sm:text-base">
            <CardTitle>ETH 김치 프리미엄</CardTitle>
            <CardDescription>ETH 가격 비교</CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="block sm:hidden space-y-1">
              <div className={`text-2xl font-semibold ${pctClass(eth?.premium)}`}>{fmtPct(eth?.premium)}</div>
              <div className="text-xs text-muted-foreground">ETH 스프레드 {fmtKRW(eth?.spread)}</div>
              <div className="text-xs text-neutral-300">국내 {fmtKRW(eth?.domestic)}</div>
              <div className="text-xs text-neutral-300">해외 {fmtKRW(eth?.foreignKrw)}</div>
            </div>
            <div className="hidden sm:block">
              <div className={`text-3xl font-semibold ${pctClass(eth?.premium)}`}>{fmtPct(eth?.premium)}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                스프레드 {fmtKRW(eth?.spread)} (국내 {fmtKRW(eth?.domestic)} · 해외 {fmtKRW(eth?.foreignKrw)})
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ====================== 컨트롤 + 리스트 ======================= */}
      <Card className="bg-[#121212] border-neutral-800">
        <CardHeader>
          {/* 모바일 상단: 검색 + 필터 버튼 */}
          <div className="sm:hidden flex items-center gap-2 mb-3 justify-end">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="심볼 검색(예: BTC)"
              className="w-1/2 sm:w-auto order-1 px-3 py-2 rounded-lg border border-neutral-700 bg-[#1a1a1a] text-sm text-neutral-200"
            />
            <button
              onClick={() => setShowFilter(true)}
              className="order-2 px-3 py-2 rounded-lg border border-neutral-700 bg-[#1a1a1a] text-sm text-neutral-200"
            >
              필터 · 정렬
            </button>
          </div>

          {/* 데스크탑 컨트롤 */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            <div className="text-sm text-muted-foreground">국내 거래소</div>
            <select value={dom} onChange={(e) => setDom(e.target.value as Domestic)} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm min-w-[90px]">
              <option>Upbit</option><option>Bithumb</option><option>Coinone</option>
            </select>

            <div className="ml-2 text-sm text-muted-foreground">해외 거래소</div>
            <select value={ovr} onChange={(e) => setOvr(e.target.value as Overseas)} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm min-w-[90px]">
              <option>Binance</option><option>Bybit</option><option>OKX</option>
            </select>

            <div className="ml-2 text-sm text-muted-foreground">기준</div>
            <select value={basis} onChange={(e) => setBasis(e.target.value as any)} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm min-w-[90px]">
              <option value="foreign">해외 기준</option>
              <option value="domestic">국내 기준</option>
            </select>

            <div className="ml-auto flex items-center gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="심볼 검색" className="px-3 py-1.5 rounded border border-neutral-700 bg-[#1a1a1a] text-sm" />
              <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm min-w-[90px]">
                <option value="premium">프리미엄%</option>
                <option value="spread">스프레드</option>
                <option value="domestic">국내가격</option>
                <option value="foreign">해외가격</option>
              </select>
              <button onClick={() => setDir((d) => (d === 'asc' ? 'desc' : 'asc'))} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] hover:bg-[#1e1e1e] text-sm">
                {dir === 'desc' ? '내림차순' : '오름차순'}
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {error ? (
            <div className="text-xs text-amber-300 mb-2 flex items-center gap-2">
              <span>API 오류: {error}</span>
              <button onClick={() => reloadRef.current()} className="px-2 py-0.5 rounded border border-amber-600 text-amber-300 hover:bg-amber-600/10">
                다시 시도
              </button>
            </div>
          ) : null}

          {/* 모바일 카드 리스트 */}
          <div className="sm:hidden space-y-3 mt-3">
            {displayed.map((r) => (
              <div
                key={`${dom}-${ovr}-${r.symbol}`}
                className="p-4 rounded-2xl border border-neutral-800 bg-[#161616] shadow-sm"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="font-semibold text-[17px] text-white">{r.symbol}</div>
                  <div className={`text-[15px] font-bold ${pctClass(r.premium)}`}>{fmtPct(r.premium)}</div>
                </div>
                <div className="flex justify-between text-[13px] text-neutral-300 mt-1">
                  <div>
                    <div className="text-neutral-400 text-[11px]">국내</div>
                    <div className="font-medium text-white">{fmtKRW(r.domestic)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-neutral-400 text-[11px]">해외</div>
                    <div className="font-medium text-white">{fmtKRW(r.foreignKrw)}</div>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[11px] text-neutral-400">스프레드</span>
                  <span className={`text-[13px] font-medium ${Number(r.spread) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmtKRW(r.spread)}
                  </span>
                </div>
                <div className="text-right text-[11px] text-neutral-500 mt-1">
                  {dom} / {ovr}
                </div>
              </div>
            ))}
            {loading ? <div className="text-xs text-neutral-400 text-center mt-2">로딩 중...</div> : null}
          </div>

          {/* 데스크탑 표 */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full text-[13px] sm:text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">심볼</th>
                  <th className="px-3 py-2 text-right font-medium">국내 가격(KRW)</th>
                  <th className="px-3 py-2 text-right font-medium">해외 가격(KRW)</th>
                  <th className="px-3 py-2 text-right font-medium">프리미엄</th>
                  <th className="px-3 py-2 text-right font-medium">스프레드</th>
                  <th className="px-3 py-2 text-right font-medium">거래소</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((r) => (
                  <tr
                    key={`${dom}-${ovr}-${r.symbol}`}
                    className="border-t border-border hover:bg-accent/20 transition-colors"
                  >
                    <td className="px-3 py-2 font-medium">{r.symbol}</td>
                    <td className="px-3 py-2 text-right">{fmtKRW(r.domestic)}</td>
                    <td className="px-3 py-2 text-right">{fmtKRW(r.foreignKrw)}</td>
                    <td className={`px-3 py-2 text-right ${pctClass(r.premium)}`}>{fmtPct(r.premium)}</td>
                    <td className={`px-3 py-2 text-right ${Number(r.spread) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmtKRW(r.spread)}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{dom} / {ovr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 모바일 필터 · 정렬 모달 */}
      {showFilter && (
        <div className="fixed inset-0 z-50" onClick={() => setShowFilter(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl border border-neutral-800 bg-[#121418] p-4 animate-kimchi-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto max-w-md space-y-3">
              <div className="text-center text-sm text-neutral-400">필터 · 정렬</div>

              <div className="space-y-1">
                <label className="text-neutral-400 text-xs">국내 거래소</label>
                <select value={dom} onChange={(e) => setDom(e.target.value as Domestic)} className="w-full px-3 py-2 rounded border border-neutral-700 bg-[#151821]">
                  <option>Upbit</option>
                  <option>Bithumb</option>
                  <option>Coinone</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 text-xs">해외 거래소</label>
                <select value={ovr} onChange={(e) => setOvr(e.target.value as Overseas)} className="w-full px-3 py-2 rounded border border-neutral-700 bg-[#151821]">
                  <option>Binance</option>
                  <option>Bybit</option>
                  <option>OKX</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 text-xs">기준</label>
                <select value={basis} onChange={(e) => setBasis(e.target.value as any)} className="w-full px-3 py-2 rounded border border-neutral-700 bg-[#151821]">
                  <option value="foreign">해외 기준 (국내/해외 - 1)</option>
                  <option value="domestic">국내 기준 (해외/국내 - 1)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 text-xs">정렬 기준</label>
                <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="w-full px-3 py-2 rounded border border-neutral-700 bg-[#151821]">
                  <option value="premium">프리미엄(%)</option>
                  <option value="spread">스프레드(KRW)</option>
                  <option value="domestic">국내가격</option>
                  <option value="foreign">해외가격</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 text-xs">정렬 방향</label>
                <button onClick={() => setDir((d) => (d === 'asc' ? 'desc' : 'asc'))} className="w-full px-3 py-2 rounded border border-neutral-700 bg-[#151821] hover:bg-[#1a1f29]">
                  {dir === 'desc' ? '내림차순' : '오름차순'}
                </button>
              </div>
            </div>

            <button onClick={() => setShowFilter(false)} className="mt-2 w-full py-2 rounded-xl bg-emerald-500 text-[13px] font-semibold text-black shadow">
              적용하기
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
// ======================= [2/3] END =======================
// Helpers & Fetchers

function num(v: any): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function convert(value?: number, currency: 'USD' | 'KRW' = 'USD', usdkrw = 0) {
  if (!Number.isFinite(value as number)) return undefined
  if (currency === 'KRW') return (value as number) * usdkrw
  return value
}

function computePremium(domestic?: number, foreignKrw?: number, basis: 'foreign' | 'domestic' = 'foreign') {
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

function fmtPct(v?: number) {
  if (!Number.isFinite(v as number)) return '--'
  const n = v as number
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}

function fmtKRW(v?: number) {
  if (!Number.isFinite(v as number)) return '--'
  return `${Math.round(v as number).toLocaleString('ko-KR')}원`
}

function pctClass(v?: number) {
  if (!Number.isFinite(v as number)) return 'text-muted-foreground'
  return (v as number) >= 0 ? 'text-emerald-400' : 'text-red-400'
}

async function fetchDomestic(exchange: Domestic, symbols: string[]): Promise<Map<string, number | undefined>> {
  try {
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/binance-proxy`
    if (exchange === 'Upbit') {
      const markets = symbols.map((s) => `KRW-${s}`).join(',')
      const r = await fetch(`${base}?url=${encodeURIComponent(`https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(markets)}`)}`)
      if (!r.ok) throw new Error('Upbit 오류')
      const j = await r.json()
      const m = new Map<string, number>()
      for (const it of j) {
        const sym = String(it.market || '').replace('KRW-', '')
        const p = num(it.trade_price)
        if (sym && p) m.set(sym, p)
      }
      return m
    }
    if (exchange === 'Bithumb') {
      const r = await fetch(`${base}?url=${encodeURIComponent('https://api.bithumb.com/public/ticker/ALL_KRW')}`)
      if (!r.ok) throw new Error('Bithumb 오류')
      const j = await r.json()
      const data = j?.data || {}
      const m = new Map<string, number>()
      for (const s of symbols) {
        const it = data?.[s]
        const p = num(it?.closing_price)
        if (p) m.set(s, p)
      }
      return m
    }
    const r = await fetch(`${base}?url=${encodeURIComponent('https://api.coinone.co.kr/public/v2/ticker?currency=all')}`)
    if (!r.ok) throw new Error('Coinone 오류')
    const j = await r.json()
    const t = j?.tickers || {}
    const m = new Map<string, number>()
    for (const s of symbols) {
      const it = t?.[s.toLowerCase()]
      const p = num(it?.last)
      if (p) m.set(s, p)
    }
    return m
  } catch {
    return new Map()
  }
}

async function fetchOverseas(exchange: Overseas, symbols: string[]): Promise<Map<string, number | undefined>> {
  try {
    if (exchange === 'Binance') {
      const arr = symbols.map((s) => `${s}USDT`)
      const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(arr))}`)
      if (!r.ok) throw new Error('Binance 오류')
      const j = await r.json()
      const m = new Map<string, number>()
      for (const it of j) {
        const sym = String(it.symbol || '').replace('USDT', '')
        const p = num(it.price)
        if (sym && p) m.set(sym, p)
      }
      return m
    }
    if (exchange === 'Bybit') {
      const r = await fetch('https://api.bybit.com/v5/market/tickers?category=spot')
      if (!r.ok) throw new Error('Bybit 오류')
      const j = await r.json()
      const list: any[] = j?.result?.list || []
      const m = new Map<string, number>()
      for (const it of list) {
        const s = String(it.symbol || '')
        if (s.endsWith('USDT')) {
          const sym = s.replace('USDT', '')
          const p = num(it.lastPrice)
          if (sym && p) m.set(sym, p)
        }
      }
      const out = new Map<string, number>()
      for (const s of symbols) if (m.has(s)) out.set(s, m.get(s)!)
      return out
    }
    const r = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT')
    if (!r.ok) throw new Error('OKX 오류')
    const j = await r.json()
    const list: any[] = j?.data || []
    const m = new Map<string, number>()
    for (const it of list) {
      const id = String(it.instId || '')
      if (id.endsWith('-USDT')) {
        const sym = id.replace('-USDT', '')
        const p = num(it.last)
        if (sym && p) m.set(sym, p)
      }
    }
    const out = new Map<string, number>()
    for (const s of symbols) if (m.has(s)) out.set(s, m.get(s)!)
    return out
  } catch {
    return new Map()
  }
}

async function listDomesticSymbols(exchange: Domestic): Promise<string[]> {
  try {
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/binance-proxy`
    if (exchange === 'Upbit') {
      const r = await fetch(`${base}?url=${encodeURIComponent('https://api.upbit.com/v1/market/all?isDetails=false')}`)
      if (!r.ok) throw new Error('Upbit list')
      const j = await r.json()
      return j.filter((it: any) => String(it.market || '').startsWith('KRW-')).map((it: any) => String(it.market).replace('KRW-', ''))
    }
    if (exchange === 'Bithumb') {
      const r = await fetch(`${base}?url=${encodeURIComponent('https://api.bithumb.com/public/ticker/ALL_KRW')}`)
      if (!r.ok) throw new Error('Bithumb list')
      const j = await r.json()
      const data = j?.data || {}
      return Object.keys(data).filter((k) => k && k.toUpperCase() === k && k.length <= 8)
    }
    const r = await fetch(`${base}?url=${encodeURIComponent('https://api.coinone.co.kr/public/v2/ticker?currency=all')}`)
    if (!r.ok) throw new Error('Coinone list')
    const j = await r.json()
    const t = j?.tickers || {}
    return Object.keys(t).map((k) => k.toUpperCase())
  } catch {
    return TARGET
  }
}

async function listOverseasSymbols(exchange: Overseas): Promise<string[]> {
  try {
    if (exchange === 'Binance') {
      const r = await fetch('https://api.binance.com/api/v3/exchangeInfo')
      if (!r.ok) throw new Error('Binance list')
      const j = await r.json()
      const syms: string[] = []
      for (const s of j?.symbols || []) {
        if (s.quoteAsset === 'USDT' && s.status === 'TRADING') syms.push(String(s.baseAsset))
      }
      return syms
    }
    if (exchange === 'Bybit') {
      const r = await fetch('https://api.bybit.com/v5/market/tickers?category=spot')
      if (!r.ok) throw new Error('Bybit list')
      const j = await r.json()
      const list: any[] = j?.result?.list || []
      return list
        .map((it) => String(it.symbol || ''))
        .filter((s) => s.endsWith('USDT'))
        .map((s) => s.replace('USDT', ''))
    }
    const r = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT')
    if (!r.ok) throw new Error('OKX list')
    const j = await r.json()
    const list: any[] = j?.data || []
    return list
      .map((it) => String(it.instId || ''))
      .filter((id) => id.endsWith('-USDT'))
      .map((id) => id.replace('-USDT', ''))
  } catch {
    return TARGET
  }
}

// ======================= [3/3] END =======================
