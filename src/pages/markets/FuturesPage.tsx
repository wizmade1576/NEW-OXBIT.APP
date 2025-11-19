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
  // 필터 모달
  const [showFilter, setShowFilter] = React.useState(false)

  // Supabase Edge Function proxy
  const prox = React.useCallback((qs: string) => {
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/binance-proxy`
    const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '')
    const url = `${base}?${qs}`
    const headers: Record<string, string> = {}
    if (anon) {
      headers['Authorization'] = `Bearer ${anon}`
      headers['apikey'] = anon
    }
    return { url, headers }
  }, [])

  const [exchange, setExchange] = React.useState<'Binance' | 'Bybit' | 'OKX'>('Binance')
  const [sortBy, setSortBy] = React.useState<'volume' | 'funding' | 'oi' | 'change24h'>('volume')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc')
  const [query, setQuery] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<'ALL' | ContractType>('ALL')
  const [rows, setRows] = React.useState<Row[]>([])
  const [rankBy, setRankBy] = React.useState<'volume' | 'oi'>('volume')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [ratioMap, setRatioMap] = React.useState<Record<string, { long: number; short: number }>>({})
  const [currency, setCurrency] = React.useState<'USD' | 'KRW'>('USD')
  const [usdkrw, setUsdkrw] = React.useState<number>(0)

  const TOP_LIMIT = 50
  const PAGE_SIZE = 25
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE)
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)

  // ---------------- FX rate (USD -> KRW, 6시간마다) ----------------
  React.useEffect(() => {
    try {
      if (!(window.location?.pathname || '').startsWith('/markets')) return
    } catch {}
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
        if (mounted && typeof rate === 'number') {
          setUsdkrw(rate)
          try {
            localStorage.setItem(key, JSON.stringify({ rate, ts: Date.now() }))
          } catch {}
        }
      } catch {}
      if (mounted) setTimeout(pull, 6 * 60 * 60 * 1000)
    }

    pull()
    return () => {
      mounted = false
    }
  }, [currency])

  // ---------------- 메인 Fetch (3분마다) ----------------
  React.useEffect(() => {
    try {
      if (!(window.location?.pathname || '').startsWith('/markets')) return
    } catch {}

    let mounted = true
    let timer: any
    const nextMs = 180_000

    const pull = async () => {
      try {
        setLoading(true)
        setError(null)

        if (exchange === 'Binance') {
          const { url, headers } = prox(`op=bundle&ex=binance&topN=10&period=5m&rankBy=${rankBy}`)
          const r = await fetch(url, { headers })
          if (!r.ok) throw new Error('Binance bundle')
          const j = await r.json()
          const parsed: Row[] = j?.rows || []
          if (mounted) setRows(parsed)

          const mm = j?.metrics || {}
          if (mm && Object.keys(mm).length) {
            setRows(prev =>
              prev.map(x => {
                const m = mm[x.symbol]
                if (!m) return x
                const add: Partial<Row> = {}
                if (typeof m.funding === 'number') add.funding = m.funding
                if (typeof m.oi === 'number' && typeof x.price === 'number') add.oi = m.oi * x.price
                return { ...x, ...add }
              }),
            )

            const nextRatio: Record<string, { long: number; short: number }> = {}
            Object.keys(mm).forEach(sym => {
              const m = mm[sym]
              if (typeof m.long === 'number' && typeof m.short === 'number') {
                nextRatio[sym] = { long: m.long, short: m.short }
              }
            })
            if (Object.keys(nextRatio).length) {
              setRatioMap(prev => ({ ...prev, ...nextRatio }))
            }
          }
        } else if (exchange === 'Bybit') {
          const { url, headers } = prox(`op=bundle&ex=bybit&topN=10&rankBy=${rankBy}`)
          const r = await fetch(url, { headers })
          if (!r.ok) throw new Error('Bybit bundle')
          const j = await r.json()
          const parsed: Row[] = j?.rows || []
          if (mounted) setRows(parsed)

          const mm = j?.metrics || {}
          if (mm && Object.keys(mm).length) {
            setRows(prev =>
              prev.map(x => {
                const m = mm[x.symbol]
                if (!m) return x
                const add: Partial<Row> = {}
                if (typeof m.funding === 'number') add.funding = m.funding
                if (typeof m.oi === 'number') add.oi = m.oi // Bybit는 이미 가치 기준
                return { ...x, ...add }
              }),
            )
          }
        } else if (exchange === 'OKX') {
          const { url, headers } = prox(`op=bundle&ex=okx&topN=10&rankBy=${rankBy}`)
          const r = await fetch(url, { headers })
          if (!r.ok) throw new Error('OKX bundle')
          const j = await r.json()
          const parsed: Row[] = j?.rows || []
          if (mounted) setRows(parsed)

          const mm = j?.metrics || {}
          if (mm && Object.keys(mm).length) {
            setRows(prev =>
              prev.map(x => {
                const m = mm[x.symbol]
                if (!m) return x
                const add: Partial<Row> = {}
                if (typeof m.funding === 'number') add.funding = m.funding
                if (typeof m.oi === 'number') add.oi = m.oi
                return { ...x, ...add }
              }),
            )
          }
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'error')
      } finally {
        setLoading(false)
        timer = setTimeout(pull, nextMs)
      }
    }

    pull()
    return () => {
      mounted = false
      if (timer) clearTimeout(timer)
    }
  }, [exchange, prox, rankBy])

  // ---------------- 필터 + 정렬 ----------------
  const filteredSorted = React.useMemo(() => {
    let list = rows
    if (typeFilter !== 'ALL') list = list.filter(r => r.contractType === typeFilter)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(r => r.symbol.toLowerCase().includes(q))
    }
    const dir = sortDir === 'asc' ? 1 : -1
    list = [...list].sort((a, b) => ((a[sortBy] ?? -Infinity) - (b[sortBy] ?? -Infinity)) * dir)
    return list
  }, [rows, query, typeFilter, sortBy, sortDir])

  // ---------------- 무한 스크롤 ----------------
  React.useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(entries => {
      if (entries.some(x => x.isIntersecting)) {
        setVisibleCount(c => Math.min(c + PAGE_SIZE, Math.min(TOP_LIMIT, filteredSorted.length)))
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [filteredSorted.length])

  return (
    <section className="space-y-6">
      {/* slide-up keyframes */}
      <style>{`
        @keyframes futures-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-futures-slide-up {
          animation: futures-slide-up 0.22s ease-out;
        }
        /* Mobile-only: hide Futures section heading (선물 마켓) */
        @media (max-width: 639px) {
          .futures-hide-title [class*="text-\\[18px\\]"] { display: none !important; }
        }
      `}</style>

      {/* 모바일 상단: 필터 버튼 + 검색창 */}
      <div className="sm:hidden flex items-center gap-2">
        <button
          onClick={() => setShowFilter(true)}
          className="order-2 px-3 py-2 rounded-md bg-[#181a1f] border border-neutral-700 text-xs font-medium text-neutral-200 shadow-sm"
        >
          필터 · 정렬
        </button>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="심볼 검색 (예: BTCUSDT)"
          className="w-1/2 px-3 py-2 rounded-md border border-neutral-700 bg-[#111318] text-sm text-neutral-100 placeholder:text-neutral-500"
        />
      </div>

      <Card className="bg-[#0d1014] border border-neutral-800 shadow-sm">
        <CardHeader className="pb-3 futures-hide-title">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-[18px] text-white">선물 마켓</CardTitle>
              <CardDescription className="text-xs text-neutral-400">
                거래소별 상위 선물/영구선물 실시간 지표
              </CardDescription>
            </div>

            {/* 데스크탑용 간단 필터 요약 배지 */}
            <div className="hidden sm:flex flex-col items-end text-[11px] text-neutral-400">
              <span>{exchange}</span>
              <span>
                {currency} · {sortBy === 'volume' ? '거래량' : sortBy === 'funding' ? '펀딩비' : sortBy === 'oi' ? 'OI' : '24h'}
                {sortDir === 'desc' ? ' ↓' : ' ↑'}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && <div className="text-xs text-amber-300 mb-2">API 오류: {error}</div>}

          {/* 데스크탑 필터 바 (기존 유지) */}
          <div className="hidden sm:flex flex-wrap gap-2 mb-2">
            <select
              value={exchange}
              onChange={e => setExchange(e.target.value as any)}
              className="px-2 py-1 rounded border border-neutral-700 bg-[#14161c] text-sm"
            >
              <option>Binance</option>
              <option>Bybit</option>
              <option>OKX</option>
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-2 py-1 rounded border border-neutral-700 bg-[#14161c] text-sm"
            >
              <option value="volume">거래량(24h)</option>
              <option value="funding">펀딩비</option>
              <option value="oi">미결제약정(OI)</option>
              <option value="change24h">24h 변동률</option>
            </select>
            <select
              value={rankBy}
              onChange={e => setRankBy(e.target.value as any)}
              className="px-2 py-1 rounded border border-neutral-700 bg-[#14161c] text-sm"
            >
              <option value="volume">상위 기준: 거래량</option>
              <option value="oi">상위 기준: OI</option>
            </select>
            <button
              onClick={() => setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))}
              className="px-2 py-1 rounded border border-neutral-700 bg-[#14161c] hover:bg-[#191c23] text-sm"
            >
              {sortDir === 'desc' ? '내림차순' : '오름차순'}
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrency('USD')}
                className={`px-2 py-1 rounded border border-neutral-700 text-sm ${
                  currency === 'USD' ? 'bg-emerald-600/20 text-emerald-300' : 'bg-[#14161c]'
                }`}
              >
                USD
              </button>
              <button
                onClick={() => setCurrency('KRW')}
                className={`px-2 py-1 rounded border border-neutral-700 text-sm ${
                  currency === 'KRW' ? 'bg-emerald-600/20 text-emerald-300' : 'bg-[#14161c]'
                }`}
              >
                KRW
              </button>
            </div>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
              className="px-2 py-1 rounded border border-neutral-700 bg-[#14161c] text-sm"
            >
              <option value="ALL">전체</option>
              <option value="PERP">Perp</option>
              <option value="FUTURES">분기물</option>
            </select>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="심볼 검색"
              className="order-first px-2 py-1 rounded border border-neutral-700 bg-[#14161c] text-sm w-1/2 min-w-[140px]"
            />
          </div>

          {/* =================== 모바일 카드 리스트 =================== */}
          <div className="sm:hidden space-y-3">
            {filteredSorted.slice(0, visibleCount).map(r => {
              const ratio = ratioMap[r.symbol]
              const long = ratio?.long ?? r.long
              const short = ratio?.short ?? r.short

              const base = (r.symbol || '')
                .replace(/USDT|USDC|PERP|USD|_.*$/i, '')
                .slice(0, 4)
                .toUpperCase()

              return (
                <div
                  key={`${exchange}-${r.symbol}`}
                  className="p-4 rounded-2xl border border-neutral-800 bg-gradient-to-b from-[#141820] to-[#0d1016] shadow-sm"
                >
                  {/* 1줄: 심볼 + 가격 */}
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-3">
                      {/* 심볼 로고 */}
                      <div className="hidden w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/80 to-cyan-400/80 flex items-center justify-center text-[11px] font-semibold text-black shadow-sm">
                        {base || r.symbol.slice(0, 3)}
                      </div>
                      <div className="flex flex-col">
                        <div className="font-semibold text-white text-[15px] leading-none">
                          {r.symbol}
                        </div>
                        <div className="text-[11px] text-neutral-400 mt-1">
                          {exchange} · {r.contractType || '선물'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[15px] font-bold text-white">
                        {formatCurrency(convert(r.price, currency, usdkrw), currency)}
                      </div>
                      <div className={`text-[11px] mt-0.5 ${pctClass(r.change24h)}`}>
                        {fmtPct(r.change24h)}
                      </div>
                    </div>
                  </div>

                  {/* 2줄: 펀딩비 + 거래량 */}
                  <div className="flex justify-between items-center text-[11px] mt-1">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-neutral-400">펀딩비</span>
                      <span className={pctClass(r.funding)}>{fmtPct(r.funding)}</span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-neutral-400">거래량 (24h)</span>
                      <span className="text-neutral-100">
                        {formatCurrency(convert(r.volume, currency, usdkrw), currency)}
                      </span>
                    </div>
                  </div>

                  {/* 3줄: 롱/숏 비율 bar */}
                  <div className="mt-3 flex justify-between items-center">
                    <span className="text-[11px] text-neutral-400">롱 / 숏 포지션 비율</span>
                    <RatioBar longPct={long} shortPct={short} compact />
                  </div>
                </div>
              )
            })}
          </div>

          {/* =================== 데스크탑 테이블 =================== */}
          <div className="hidden sm:block overflow-x-auto mt-2">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-neutral-400 border-b border-neutral-800">
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
                {filteredSorted.slice(0, visibleCount).map(r => {
                  const ratio = ratioMap[r.symbol]
                  const long = ratio?.long ?? r.long
                  const short = ratio?.short ?? r.short

                  return (
                    <tr
                      key={`${exchange}-${r.symbol}`}
                      className="border-b border-neutral-900/80 hover:bg-[#151923] transition-colors"
                    >
                      <td className="px-3 py-2 font-medium text-neutral-100">{r.symbol}</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(convert(r.price, currency, usdkrw), currency)}
                      </td>
                      <td className={`px-3 py-2 text-right ${pctClass(r.change24h)}`}>
                        {fmtPct(r.change24h)}
                      </td>
                      <td className={`px-3 py-2 text-right ${pctClass(r.funding)}`}>
                        {fmtPct(r.funding)}
                      </td>
                      <td className="px-3 py-2 text-right hidden sm:table-cell">
                        {formatCurrency(convert(r.oi, currency, usdkrw), currency)}
                      </td>
                      <td className="px-3 py-2 text-right hidden md:table-cell">
                        <RatioBar longPct={long} shortPct={short} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(convert(r.volume, currency, usdkrw), currency)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* sentinel + 로딩 표시 */}
          <div ref={sentinelRef} />
          {visibleCount < Math.min(TOP_LIMIT, filteredSorted.length) && (
            <div className="mt-2 flex justify-center">
              <button
                onClick={() =>
                  setVisibleCount(c =>
                    Math.min(c + PAGE_SIZE, Math.min(TOP_LIMIT, filteredSorted.length)),
                  )
                }
                className="px-3 py-1 rounded border border-neutral-700 bg-[#151821] hover:bg-[#1a1d27] text-sm text-neutral-100"
              >
                더 보기
              </button>
            </div>
          )}
          {loading && (
            <div className="text-center text-xs text-neutral-400 mt-2">업데이트 중...</div>
          )}
        </CardContent>
      </Card>

      {/* =================== 모바일 슬라이드 필터 모달 =================== */}
      {showFilter && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:hidden">
          <div className="w-full max-w-md rounded-t-2xl border border-neutral-700 bg-[#111318] p-4 pb-5 animate-futures-slide-up">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">선물 필터 · 정렬</h2>
              <button
                onClick={() => setShowFilter(false)}
                className="text-xs text-neutral-400 px-2 py-1 rounded hover:bg-white/5"
              >
                닫기
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-neutral-400">거래소</label>
                <select
                  value={exchange}
                  onChange={e => setExchange(e.target.value as any)}
                  className="w-full px-3 py-2 rounded border border-neutral-700 bg-[#151821]"
                >
                  <option>Binance</option>
                  <option>Bybit</option>
                  <option>OKX</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400">정렬 기준</label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 rounded border border-neutral-700 bg-[#151821]"
                >
                  <option value="volume">거래량(24h)</option>
                  <option value="funding">펀딩비</option>
                  <option value="oi">미결제약정(OI)</option>
                  <option value="change24h">24h 변동률</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400">상위 기준</label>
                <select
                  value={rankBy}
                  onChange={e => setRankBy(e.target.value as any)}
                  className="w-full px-3 py-2 rounded border border-neutral-700 bg-[#151821]"
                >
                  <option value="volume">거래량 기준</option>
                  <option value="oi">OI 기준</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400">통화</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrency('USD')}
                    className={`flex-1 py-2 rounded border border-neutral-700 text-xs ${
                      currency === 'USD'
                        ? 'bg-emerald-600/20 text-emerald-300'
                        : 'bg-[#151821] text-neutral-200'
                    }`}
                  >
                    USD
                  </button>
                  <button
                    onClick={() => setCurrency('KRW')}
                    className={`flex-1 py-2 rounded border border-neutral-700 text-xs ${
                      currency === 'KRW'
                        ? 'bg-emerald-600/20 text-emerald-300'
                        : 'bg-[#151821] text-neutral-200'
                    }`}
                  >
                    KRW
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400">계약 종류</label>
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value as any)}
                  className="w-full px-3 py-2 rounded border border-neutral-700 bg-[#151821]"
                >
                  <option value="ALL">전체</option>
                  <option value="PERP">Perp</option>
                  <option value="FUTURES">분기물</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => setShowFilter(false)}
              className="mt-4 w-full py-2 rounded-xl bg-emerald-500 text-[13px] font-semibold text-black shadow"
            >
              적용하기
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/* =================== 공용 컴포넌트 & 유틸 =================== */

function RatioBar({
  longPct,
  shortPct,
  compact,
}: {
  longPct?: number
  shortPct?: number
  compact?: boolean
}) {
  const lp = Math.max(0, Math.min(100, longPct ?? 50))
  const sp = Math.max(0, Math.min(100, shortPct ?? 50))
  const total = lp + sp || 100
  const lw = Math.round((lp / total) * 100)
  const sw = 100 - lw

  return (
    <div
      className="inline-flex items-center gap-2 justify-end"
      title={`Long ${lp.toFixed(1)}% / Short ${sp.toFixed(1)}%`}
    >
      <div
        className={`h-2.5 rounded-full bg-neutral-900 overflow-hidden grid ${
          compact ? 'w-24' : 'w-32'
        }`}
        style={{ gridTemplateColumns: `${lw}% ${sw}%` }}
      >
        <div className="bg-emerald-500" />
        <div className="bg-red-500" />
      </div>
      <span className={`text-[10px] text-neutral-400 ${compact ? '' : 'min-w-[90px] text-right'}`}>
        L {lp.toFixed(0)}% / S {sp.toFixed(0)}%
      </span>
    </div>
  )
}

function fmtPct(v?: number) {
  if (!Number.isFinite(v as number)) return '--'
  const n = v as number
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}

function pctClass(v?: number) {
  if (!Number.isFinite(v as number)) return 'text-neutral-400'
  return v! >= 0 ? 'text-emerald-400' : 'text-red-400'
}

function convert(value?: number, currency: 'USD' | 'KRW' = 'USD', usdkrw = 0) {
  if (!Number.isFinite(value as number)) return undefined
  if (currency === 'USD') return value
  if (usdkrw > 0) return (value as number) * usdkrw
  return undefined
}

function formatCurrency(v?: number, currency: 'USD' | 'KRW' = 'USD') {
  if (!Number.isFinite(v as number)) return '--'
  return currency === 'USD'
    ? `$${(v as number).toLocaleString('en-US')}`
    : `${Math.round(v as number).toLocaleString('ko-KR')}원`
}
