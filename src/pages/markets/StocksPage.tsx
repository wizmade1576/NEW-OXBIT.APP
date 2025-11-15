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
      if (p.includes('NAS100')) return 'US100 Cash CFD'
      if (p.includes('SPX500')) return 'S&P 500 Index'
      return sym
    } catch { return sym }
  }
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [loaded, setLoaded] = React.useState(false)
  // Stocks 첫 화면을 나스닥(ETF QQQ)으로 시작
  const [symbol, setSymbol] = React.useState<string>('OANDA:NAS100USD')
  const [interval, setIntervalState] = React.useState<string>('15')
  const [theme, setTheme] = React.useState<'dark' | 'light'>('dark')

  React.useEffect(() => {
    if ((window as any).TradingView) { setLoaded(true); return }
    const s = document.createElement('script')
    s.src = 'https://s3.tradingview.com/tv.js'
    s.async = true
    s.onload = () => setLoaded(true)
    document.head.appendChild(s)
  }, [])

  React.useEffect(() => {
    if (!loaded || !containerRef.current) return
    containerRef.current.innerHTML = ''
    try {
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
        allow_symbol_change: false,
        withdateranges: true,
      })
      // Ensure the intended symbol is applied; add robust fallback for DXY
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
  }, [loaded, symbol, interval, theme])

  const [tiles, setTiles] = React.useState<Tile[]>([
    // 일부 TVC 지수는 임베드 제한이 있어 ETF 프록시로 매핑
    { id: 'nasdaq', label: 'NASDAQ 100', symbol: 'OANDA:NAS100USD', value: '25,000', change: '+0.10%', up: true },
    { id: 'spx', label: 'S&P 500 Index', symbol: 'OANDA:SPX500USD', value: '6,740', change: '+0.16%', up: true },
    { id: 'dxy', label: '달러 인덱스', symbol: 'AMEX:UUP', value: '106.12', change: '-0.08%', up: false },
    { id: 'btcd', label: 'BTC Dominance', symbol: 'CRYPTOCAP:BTC.D', value: '60.11%', change: '+0.10%', up: true },
    { id: 'btc', label: 'BTC 가격', symbol: 'BINANCE:BTCUSDT', value: '102,990', change: '-0.30%', up: false },
  ])

  // Optional: expanded indicators (더보기)
  const [expanded, setExpanded] = React.useState<boolean>(false)
  const [extraTiles, setExtraTiles] = React.useState<Tile[]>([
    { id: 'dji', label: 'Dow Jones', symbol: 'TVC:DJI', value: '38,500', change: '+0.05%', up: true },
    { id: 'rut', label: 'Russell 2000', symbol: 'TVC:RUT', value: '2,020', change: '-0.12%', up: false },
    { id: 'xau', label: 'Gold (XAU/USD)', symbol: 'OANDA:XAUUSD', value: '2,350.0', change: '+0.10%', up: true },
    { id: 'wti', label: 'WTI (XTI/USD)', symbol: 'TVC:USOIL', value: '78.60', change: '-0.08%', up: false },
    { id: 'eth', label: 'ETH 가격', symbol: 'BINANCE:ETHUSDT', value: '3,120', change: '+0.20%', up: true },
  ])

  // Real-time BTC price via Binance WebSocket
  React.useEffect(() => {
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
  }, [])

  // BTC Dominance from CoinGecko (60s poll)
  React.useEffect(() => {
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
  }, [])

  // Simulate NASDAQ, S&P500, DXY small drift every 20s
  React.useEffect(() => {
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
      // also drift extra tiles lightly (demo)
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
  }, [])

  // Twelve Data polling for NDX/SPX/DXY if API key exists (60s)
  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const API_KEY: any = (import.meta as any).env?.VITE_TWELVE_API_KEY
    if (!API_KEY) return // keep demo drift if no key
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
      } catch {
        // ignore and try again later
      }
      timer = setTimeout(pull, 60000)
    }
    pull()
    return () => { if (timer) clearTimeout(timer) }
  }, [])

  // ETH price via Binance WebSocket (optional extra tile)
  React.useEffect(() => {
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
  }, [])

  return (
    <section className="space-y-4">
      {/* Primary indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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

      {/* Expandable indicators */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">지표 확장</div>
        <button onClick={()=>setExpanded(e=>!e)} className="px-2 py-1 rounded border border-neutral-700 bg-[#121212] hover:bg-[#1e1e1e] text-sm">{expanded?'접기':'더보기'}</button>
      </div>
      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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

      <Card className="bg-[#121212] border-neutral-800">
        <CardHeader>
          <div className="flex flex-col gap-2">
            <CardTitle className="text-white">실시간 차트</CardTitle>
            <CardDescription>
              {prettyName(symbol)} · {interval} · {prettyExchange(symbol)}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div id="tv_chart_container" ref={containerRef as any} className="h-[520px] w-full" />
          {!loaded && (
            <div className="h-[520px] w-full grid place-items-center text-sm text-gray-400">차트 로딩중...</div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
