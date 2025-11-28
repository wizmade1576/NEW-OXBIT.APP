import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'

type Tile = { id: string; label: string; value: string; change: string; up: boolean; symbol: string }

export default function StocksPage() {
  const prettyExchange = (sym: string): string => {
    try {
      const exch = (sym.split(':')[0] || '').toUpperCase()
      if (exch === 'CAPITALCOM') return 'Capital.com'
      if (exch === 'CURRENCYCOM') return 'Currency.com'
      if (exch === 'OANDA') return 'OANDA'
      if (exch === 'FOREXCOM') return 'FOREXCOM'
      if (exch === 'TVC') return 'TVC'
      if (exch === 'ICEUS') return 'ICE'
      if (exch === 'AMEX') return 'AMEX'
      return exch || sym
    } catch { return sym }
  }
  const prettyName = (sym: string): string => {
    try {
      const p = sym.toUpperCase()
      if (p.includes('USDX') || p.includes('DXY') || p.includes('DX1!')) return 'AMEX'
      if (p.includes('US100') || p.includes('NAS100')) return '유에스 100 캐쉬 CFD'
      if (p.includes('SPX') || p.includes('US500')) return 'S&P 500 인덱스'
      return sym
    } catch { return sym }
  }

  const isStocksPage = window.location.pathname === '/markets/stocks'  // ★ 보호막

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [loaded, setLoaded] = React.useState(false)
  const [symbol, setSymbol] = React.useState<string>('FOREXCOM:NAS100')
  const [interval] = React.useState<string>('15')
  const theme: 'dark' | 'light' = 'dark'

  // TradingView 스크립트 로더
  React.useEffect(() => {
    if (!isStocksPage) return  // ★ 추가

    if ((window as any).TradingView) { setLoaded(true); return }
    const s = document.createElement('script')
    s.src = 'https://s3.tradingview.com/tv.js'
    s.async = true
    s.onload = () => setLoaded(true)
    document.head.appendChild(s)
  }, [isStocksPage])

  // TradingView 초기화
  React.useEffect(() => {
    if (!isStocksPage) return  // ★ 추가

    if (!loaded || !containerRef.current) return
    containerRef.current.innerHTML = ''
    try {
      const mobile = (() => {
        try { return window.matchMedia && window.matchMedia('(max-width: 639px)').matches } catch { return false }
      })()
      // @ts-ignore
      const widget = new (window as any).TradingView.widget({
        container_id: 'tv_chart_container',
        autosize: true,
        symbol,
        interval,
        timezone: 'Asia/Seoul',
        theme,
        style: '1',
        locale: 'ko',
        hide_top_toolbar: false,
        hide_side_toolbar: mobile ? true : false,
        allow_symbol_change: false,
        withdateranges: true,
        hide_legend: mobile ? true : false,
      })

      if (typeof (widget as any)?.onChartReady === 'function') {
        ;(widget as any).onChartReady(() => {
          const applySymbol = (target: string) => {
            try { (widget as any).activeChart?.().setSymbol?.(target) } catch {}
            try { (widget as any).chart?.().setSymbol?.(target, undefined) } catch {}
          }
          const getCurrent = (): string => {
            try { return (widget as any).activeChart?.().symbol?.() || '' } catch {}
            try { return (widget as any).chart?.().symbol?.() || '' } catch {}
            return ''
          }
          const verifyAndFallback = (desired: string) => {
            const isUsdIndex = /DXY|USDX|DX1!|UUP/i.test(desired)
            const candidates = isUsdIndex
              ? ['CAPITALCOM:USDX', 'CURRENCYCOM:USDX', 'TVC:DXY', 'ICEUS:DX1!', 'AMEX:UUP']
              : [desired]
            let i = 0
            const tryNext = () => {
              if (i >= candidates.length) return
              const tgt = candidates[i++]
              applySymbol(tgt)
              let attempts = 0
              const check = () => {
                attempts++
                const cur = (getCurrent() || '').toUpperCase()
                if (cur === tgt.toUpperCase()) return
                if (attempts < 6) { setTimeout(check, 400); return }
                tryNext()
              }
              setTimeout(check, 400)
            }
            tryNext()
          }
          verifyAndFallback(symbol)
        })
      }
    } catch {}
  }, [isStocksPage, loaded, symbol, interval, theme])

  const [tiles, setTiles] = React.useState<Tile[]>([
    { id: 'nasdaq', label: '유에스 100 캐쉬 CFD', symbol: 'FOREXCOM:NAS100', value: '25,000', change: '+0.10%', up: true },
    { id: 'spx', label: 'S&P 500 인덱스', symbol: 'FOREXCOM:SPXUSD', value: '6,740', change: '+0.16%', up: true },
    { id: 'dxy', label: '달러 인덱스', symbol: 'AMEX:UUP', value: '106.12', change: '-0.08%', up: false },
    { id: 'btcd', label: 'BTC Dominance', symbol: 'CRYPTOCAP:BTC.D', value: '60.11%', change: '+0.10%', up: true },
    { id: 'btc', label: 'BTC 가격', symbol: 'BINANCE:BTCUSDT', value: '102,990', change: '-0.30%', up: false },
  ])

  const [expanded, setExpanded] = React.useState<boolean>(false)
  const [extraTiles, setExtraTiles] = React.useState<Tile[]>([
    { id: 'dji', label: 'Dow Jones', symbol: 'TVC:DJI', value: '38,500', change: '+0.05%', up: true },
    { id: 'rut', label: 'Russell 2000', symbol: 'TVC:RUT', value: '2,020', change: '-0.12%', up: false },
    { id: 'xau', label: 'Gold (XAU/USD)', symbol: 'OANDA:XAUUSD', value: '2,350.0', change: '+0.10%', up: true },
    { id: 'wti', label: 'WTI (XTI/USD)', symbol: 'TVC:USOIL', value: '78.60', change: '-0.08%', up: false },
    { id: 'eth', label: 'ETH 가격', symbol: 'BINANCE:ETHUSDT', value: '3,120', change: '+0.20%', up: true },
  ])

  // BTC 실시간 WebSocket
  React.useEffect(() => {
    if (!isStocksPage) return  // ★ 추가

    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker')
    ws.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data)
        const last = parseFloat(d.c)
        const pct = parseFloat(d.P)
        if (Number.isFinite(last) && Number.isFinite(pct)) {
          setTiles((arr) => arr.map(t => t.id === 'btc' ? {
            ...t,
            value: last.toLocaleString(undefined, { maximumFractionDigits: 2 }),
            change: `${pct>0?'+':''}${pct.toFixed(2)}%`,
            up: pct >= 0,
          } : t))
        }
      } catch {}
    }
    return () => { try { ws.close() } catch {} }
  }, [isStocksPage])

  // CoinGecko BTC Dominance
  React.useEffect(() => {
    if (!isStocksPage) return  // ★ 추가

    let timer: any
    const fetchDom = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/global')
        const j = await res.json()
        const pct = j?.data?.market_cap_percentage?.btc
        if (typeof pct === 'number') {
          setTiles((arr) => arr.map(t => t.id === 'btcd' ? {
            ...t,
            value: `${pct.toFixed(2)}%`,
            change: t.change,
            up: true,
          } : t))
        }
      } catch {}
      timer = setTimeout(fetchDom, 60000)
    }
    fetchDom()
    return () => { if (timer) clearTimeout(timer) }
  }, [isStocksPage])

  // NASDAQ / SPX / DXY Drift
  React.useEffect(() => {
    if (!isStocksPage) return  // ★ 추가

    const id = setInterval(() => {
      setTiles((arr) => arr.map(t => {
        if (t.id === 'nasdaq' || t.id === 'spx' || t.id === 'dxy') {
          const base = parseFloat(t.value.replace(/,/g, '')) || 0
          const drift = (Math.random() - 0.5) * (t.id === 'dxy' ? 0.1 : 5)
          const next = base + drift
          const pct = (drift / (base || 1)) * 100
          return {
            ...t,
            value: (t.id === 'dxy' ? next.toFixed(2) : next.toLocaleString(undefined, { maximumFractionDigits: 1 })),
            change: `${pct>0?'+':''}${pct.toFixed(2)}%`,
            up: pct >= 0,
          }
        }
        return t
      }))
      setExtraTiles((arr) => arr.map(t => {
        if (t.id === 'eth') return t
        const base = parseFloat(t.value.replace(/,/g, '')) || 0
        const drift = (Math.random() - 0.5) * 2
        const next = base + drift
        const pct = (drift / (base || 1)) * 100
        return {
          ...t,
          value: next.toLocaleString(undefined, { maximumFractionDigits: 2 }),
          change: `${pct>0?'+':''}${isFinite(pct) ? pct.toFixed(2) : '0.00'}%`,
          up: pct >= 0,
        }
      }))
    }, 20000)
    return () => clearInterval(id)
  }, [isStocksPage])

  // Twelve Data polling
  React.useEffect(() => {
    if (!isStocksPage) return  // ★ 추가

    const API_KEY: any = (import.meta as any).env?.VITE_TWELVE_API_KEY
    if (!API_KEY) return
    let timer: any
    const pull = async () => {
      try {
        const url = `https://api.twelvedata.com/quote?symbol=NDX,SPX,DXY&apikey=${API_KEY}`
        const res = await fetch(url)
        const data = await res.json()
        const updateFrom = (sym: string, id: 'nasdaq'|'spx'|'dxy') => {
          const q = data?.[sym]
          if (!q) return
          const price = parseFloat(q?.price)
          const change_pct = parseFloat(q?.percent_change)
          if (!Number.isFinite(price) || !Number.isFinite(change_pct)) return
          setTiles((arr) => arr.map(t => t.id === id ? {
            ...t,
            value: id==='dxy' ? price.toFixed(2) : price.toLocaleString(undefined, { maximumFractionDigits: 1 }),
            change: `${change_pct>0?'+':''}${change_pct.toFixed(2)}%`,
            up: change_pct >= 0,
          } : t))
        }
        updateFrom('NDX', 'nasdaq')
        updateFrom('SPX', 'spx')
        updateFrom('DXY', 'dxy')
      } catch {}
      timer = setTimeout(pull, 60000)
    }
    pull()
    return () => { if (timer) clearTimeout(timer) }
  }, [isStocksPage])

  // ETH WebSocket
  React.useEffect(() => {
    if (!isStocksPage) return  // ★ 추가

    const ws = new WebSocket('wss://stream.binance.com:9443/ws/ethusdt@ticker')
    ws.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data)
        const last = parseFloat(d.c)
        const pct = parseFloat(d.P)
        setExtraTiles((arr) => arr.map(t => t.id === 'eth' ? ({
          ...t,
          value: last.toLocaleString(undefined, { maximumFractionDigits: 2 }),
          change: `${pct>0?'+':''}${pct.toFixed(2)}%`,
          up: pct >= 0,
        }) : t))
      } catch {}
    }
    return () => { try { ws.close() } catch {} }
  }, [isStocksPage])

  const indicators = React.useMemo(() => {
    const byId = new Map<string, Tile>()
    ;[...tiles, ...extraTiles].forEach(t => { byId.set(t.id, t) })
    return Array.from(byId.values())
  }, [tiles, extraTiles])

  const [selectedId, setSelectedId] = React.useState<string>('nasdaq')
  const selectedItem = React.useMemo(() => indicators.find(i => i.id === selectedId) || indicators[0], [indicators, selectedId])

  React.useEffect(() => {
    if (!isStocksPage) return  // ★ 추가

    if (!selectedItem) return
    const mapped = selectedItem.id === 'dxy' ? 'CAPITALCOM:USDX' : selectedItem.symbol
    if (mapped) setSymbol(mapped)
  }, [isStocksPage, selectedItem])

  return (
    <section className="space-y-4">
      <style>{`
        @media (max-width: 639px) {
          #tv_chart_container { height: 360px !important; }
        }
      `}</style>

      {/* Mobile */}
      <div className="block sm:hidden space-y-2">
        <label className="block text-xs text-muted-foreground">시장 지표</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full px-3 py-2 rounded border border-neutral-700 bg-[#1a1a1a] text-[13px]"
        >
          {indicators.map((t) => (
            <option key={`opt-${t.id}`} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* 데스크톱 */}
      <div className="hidden sm:grid grid-cols-2 lg:grid-cols-5 gap-3">
        {tiles.map((t) => {
          const val = (!t.value || t.value === 'NaN') ? '--' : t.value
          const chg = (!t.change || /NaN/.test(t.change)) ? '--' : t.change
          const chgClass = (!t.change || /NaN/.test(t.change)) ? 'text-gray-400 text-sm' : (t.up ? 'text-emerald-400 text-sm' : 'text-red-400 text-sm')
          const mappedSymbol = t.id==='dxy' ? 'CAPITALCOM:USDX' : t.symbol
          return (
            <button key={t.id} onClick={() => setSymbol(mappedSymbol)} className={`text-left rounded-lg border border-neutral-800 bg-[#121212] p-3 hover:bg-[#1e1e1e] transition-colors ${symbol===mappedSymbol ? 'ring-1 ring-emerald-400' : ''}`}>
              <div className="text-xs text-gray-400">{t.id==='dxy' ? 'USD Index' : t.label}</div>
              <div className="mt-1 flex items-end justify-between">
                <div className="text-lg font-semibold text-white">{val}</div>
                <div className={chgClass}>{chg}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* 확장 영역 */}
      <div className="hidden sm:flex items-center justify-between">
        <div className="text-sm text-gray-400">지표 확장</div>
        <button onClick={()=>setExpanded(e=>!e)} className="px-2 py-1 rounded border border-neutral-700 bg-[#121212] hover:bg-[#1e1e1e] text-sm">{expanded?'접기':'더보기'}</button>
      </div>
      {expanded && (
        <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {extraTiles.map((t) => {
            const val = (!t.value || t.value === 'NaN') ? '--' : t.value
            const chg = (!t.change || /NaN/.test(t.change)) ? '--' : t.change
            const chgClass = (!t.change || /NaN/.test(t.change)) ? 'text-gray-400 text-sm' : (t.up ? 'text-emerald-400 text-sm' : 'text-red-400 text-sm')
            return (
              <button key={t.id} onClick={() => setSymbol(t.symbol)} className={`text-left rounded-lg border border-neutral-800 bg-[#121212] p-3 hover:bg-[#1e1e1e] transition-colors ${symbol===t.symbol ? 'ring-1 ring-emerald-400' : ''}`}>
                <div className="text-xs text-gray-400">{t.label}</div>
                <div className="mt-1 flex items-end justify-between">
                  <div className="text-lg font-semibold text-white">{val}</div>
                  <div className={chgClass}>{chg}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* 차트 */}
      <Card className="bg-[#121212] border-neutral-800">
        <CardHeader>
          <div className="flex flex-col gap-2">
            <CardTitle className="text-white">실시간 차트</CardTitle>
            <CardDescription>
              {prettyName(symbol)} · {interval} · {prettyExchange(symbol)}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-4">
          <div id="tv_chart_container" ref={containerRef as any} className="h-[360px] sm:h-[520px] w-full" />
          {!loaded && (
            <div className="h-[520px] w-full grid place-items-center text-sm text-gray-400">차트 로딩중...</div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
