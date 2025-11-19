import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'

type Streamer = {
  id: string
  name: string
  handle?: string
  avatar?: string
  online?: boolean
  onlineFor?: string
}

type Position = {
  id: string
  streamer: Streamer
  symbol: string
  side: 'Long' | 'Short'
  leverage?: number
  size?: number // 수량(계약 수)
  entry: number
  mark: number
  liq: number
  pnl?: number // P&L in USD
  spark?: number[]
}

// 카드에 주입할 새로운 컬럼 기반 타입
type PositionCardProps = {
  id: string
  bjName: string
  bjAvatar?: string
  symbol: string
  side: 'Long' | 'Short'
  leverage?: number
  qty?: number
  pnlUsd?: number
  entry: number
  mark: number
  liq: number
  pnlKrw?: number
  pnlTag: '수익' | '손실'
  online?: boolean
  onlineFor?: string
  spark?: number[]
  onHover?: (id: string) => void
  onLeave?: () => void
}

export default function PositionsPage() {
  // 상태는 기존 유지: localStorage + 데모 데이터
  const [list, setList] = React.useState<Position[]>(() => loadPositionsFromStorage() || demoPositions())
  const [query, setQuery] = React.useState('')
  const [onlyOnline, setOnlyOnline] = React.useState(false)
  const symbols = React.useMemo(() => Array.from(new Set(list.map((p) => p.symbol))), [list])
  // 드롭다운용 가용 심볼 목록 (중복 제거)
  const availableSymbols = React.useMemo(
    () => Array.from(new Set([
      ...symbols,
      'BTCUSDT',
      'ETHUSDT',
      'SOLUSDT',
      'XRPUSDT',
      'BNBUSDT',
      'DOGEUSDT',
      'ADAUSDT',
      'AVAXUSDT',
      'TRXUSDT',
      'DOTUSDT',
    ])),
    [symbols]
  )
  const [symbol, setSymbol] = React.useState<string>(() => symbols[0] || 'BTCUSDT')
  const [showEntries, setShowEntries] = React.useState(true)
  const [hoveredId, setHoveredId] = React.useState<string | undefined>(undefined)
  const [timeframe, setTimeframe] = React.useState<'1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M'>('1m')

  React.useEffect(() => {
    const t = setInterval(() => {
      setList((prev) =>
        prev.map((p) => ({
          ...p,
          mark: p.mark,
          pnl: computePnl(p),
          spark: p.spark?.slice(-59).concat([(p.spark?.[p.spark?.length - 1] || p.entry) * (1 + (Math.random() - 0.5) * 0.002)])
        }))
      )
    }, 5000)
    return () => clearInterval(t)
  }, [])

  const displayed = React.useMemo(() => {
    let arr = list
    if (onlyOnline) arr = arr.filter((p) => p.streamer.online)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      arr = arr.filter((p) => p.symbol.toLowerCase().includes(q) || p.streamer.name.toLowerCase().includes(q))
    }
    return arr
  }, [list, query, onlyOnline])

  return (
    <section className="space-y-4">
      {/* 상단 차트 + 컨트롤 */}
      <Card className="bg-[#141414] border-neutral-800" style={{ overflowAnchor: 'none' }}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>실시간 포지션 차트</CardTitle>
              <CardDescription>{symbol} 최근 변동 및 진입선 표시</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* 심볼 드롭다운 */}
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="px-2 py-1.5 rounded border border-neutral-700 bg-[#1a1a1a] text-sm w-[140px]"
              >
                {availableSymbols.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={showEntries} onChange={(e) => setShowEntries(e.target.checked)} /> 진입선
              </label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as any)}
                className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm"
              >
                
                <option value="1m">1m</option>
                <option value="3m">3m</option>
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="30m">30m</option>
                <option value="1h">1h</option>
                <option value="4h">4h</option>
                <option value="1d">1d</option>
                <option value="1w">1w</option>
                <option value="1M">1M</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PriceChartLW
            symbol={symbol}
            timeframe={timeframe}
            entries={
              showEntries
                ? list
                    .filter((p) => p.symbol === symbol)
                    .map((p) => ({ id: p.id, label: p.streamer.name, price: p.entry, side: p.side, leverage: p.leverage, size: p.size }))
                : []
            }
            hoveredId={hoveredId}
            onPrice={(price) => {
              setList((prev) => prev.map((p) => (p.symbol === symbol ? { ...p, mark: price, pnl: computePnl({ ...p, mark: price }) } : p)))
            }}
          />
        </CardContent>
      </Card>

      {/* 검색 필터 */}
      <div className="flex items-center gap-1 sm:gap-2 flex-nowrap sm:flex-wrap overflow-hidden">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="검색(예: BTC, BJ이름)"
          className="flex-[1_1_50%] min-w-0 px-2 py-1.5 sm:px-3 sm:py-2 rounded border border-neutral-700 bg-[#1a1a1a] text-xs sm:text-sm"
        />
        <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground shrink-0 whitespace-nowrap">
          <input type="checkbox" checked={onlyOnline} onChange={(e) => setOnlyOnline(e.target.checked)} /> ON만 보기
        </label>
        <button
          onClick={() => savePositionsToStorage(list)}
          className="ml-1 sm:ml-auto shrink-0 px-2 py-1 sm:px-3 sm:py-1.5 rounded border border-neutral-700 bg-[#1a1a1a] hover:bg-[#1e1e1e] text-xs sm:text-sm"
        >
          목록 저장
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3" style={{ overflowAnchor: 'none' }}>
        {displayed.map((p) => {
          // 기존 fetch/상태는 유지, UI 표시 필드만 매핑
          const KRW_RATE = 1350
          const pnlUsd = p.pnl
          const pnlKrw = (pnlUsd || 0) * KRW_RATE
          const pnlTag: '수익' | '손실' = (pnlUsd || 0) >= 0 ? '수익' : '손실'
          const cardProps: PositionCardProps = {
            id: p.id,
            bjName: p.streamer.name,
            bjAvatar: p.streamer.avatar,
            symbol: p.symbol,
            side: p.side,
            leverage: p.leverage,
            qty: p.size,
            pnlUsd,
            entry: p.entry,
            mark: p.mark,
            liq: p.liq,
            pnlKrw,
            pnlTag,
            online: p.streamer.online,
            onlineFor: p.streamer.onlineFor,
            spark: p.spark,
            onHover: (id) => setHoveredId(id),
            onLeave: () => setHoveredId(undefined)
          }
          return <PositionCard key={p.id} {...cardProps} />
        })}
      </div>
    </section>
  )
}

function computePnl(p: Position) {
  const side = p.side === 'Long' ? 1 : -1
  return (p.mark - p.entry) * side * (p.size || 0)
}
function fmtUSD(v?: number) {
  if (!Number.isFinite(v as number)) return '--'
  return '$' + (v as number).toLocaleString('en-US', { maximumFractionDigits: 2 })
}
function fmtNum(v?: number) {
  if (!Number.isFinite(v as number)) return '--'
  return (v as number).toLocaleString()
}
function fmtKRW(v?: number) {
  if (!Number.isFinite(v as number)) return '--'
  return '₩' + Math.round(v as number).toLocaleString('ko-KR')
}

function SparkLine({ data, up, height = 36 }: { data: number[]; up: boolean; height?: number }) {
  if (!data || data.length === 0) return <div style={{ height }} className="w-full bg-neutral-800 rounded" />
  const w = 120,
    h = height
  const min = Math.min(...data),
    max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y}`
    })
    .join(' ')
  const stroke = up ? '#34d399' : '#f87171'
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline fill="none" stroke={stroke} strokeWidth="2" points={points} />
    </svg>
  )
}

// 상단 차트 (Lightweight Charts; CDN 로드)
function PriceChartLW({
  symbol,
  timeframe = '1m',
  entries,
  hoveredId,
  onPrice
}: {
  symbol: string
  timeframe?: '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M'
  entries: { id: string; label: string; price: number; side: 'Long' | 'Short'; leverage?: number; size?: number }[]
  hoveredId?: string
  onPrice?: (price: number) => void
}) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const chartRef = React.useRef<any>(null)
  const seriesRef = React.useRef<any>(null)
  const [data, setData] = React.useState<
    { time: number; open: number; high: number; low: number; close: number }[]
  >([])

  React.useEffect(() => {
    const abort = new AbortController()
    const run = async () => {
      try {
        const sym = symbol.toUpperCase()
        const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(timeframe)}&limit=200`
        const r = await fetch(url, { signal: abort.signal })
        if (!r.ok) return
        const j: any[] = await r.json()
        const arr = Array.isArray(j)
          ? j.map((row) => ({
              time: Math.floor(Number(row[0]) / 1000),
              open: Number(row[1]),
              high: Number(row[2]),
              low: Number(row[3]),
              close: Number(row[4])
            }))
          : []
        if (arr.length) setData(arr)
      } catch {}
    }
    run()
    return () => abort.abort()
  }, [symbol, timeframe])

  React.useEffect(() => {
    let ws: WebSocket | null = null
    const ch = symbol.toLowerCase()
    try {
      ws = new WebSocket(`wss://fstream.binance.com/ws/${ch}@kline_${timeframe}`)
      ws.onmessage = (ev) => {
        try {
          const j = JSON.parse(ev.data as string)
          const k = j?.k
          const open = Number(k?.o)
          const high = Number(k?.h)
          const low = Number(k?.l)
          const close = Number(k?.c)
          const t = Number(k?.t)
          if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close) || !Number.isFinite(t)) return
          if (onPrice) onPrice(close)
          const ts = Math.floor(t / 1000)
          setData((prev) => {
            if (!prev.length) return [{ time: ts, open, high, low, close }]
            const last = prev[prev.length - 1]
            if (last.time === ts) return [...prev.slice(0, -1), { time: ts, open, high, low, close }]
            return [...prev.slice(-999), { time: ts, open, high, low, close }]
          })
        } catch {}
      }
    } catch {}
    return () => {
      try {
        ws?.close()
      } catch {}
    }
  }, [symbol, timeframe])

  React.useEffect(() => {
    let destroyed = false
    const load = async () => {
      if ((window as any).LightweightCharts) return (window as any).LightweightCharts
      await new Promise<void>((resolve) => {
        const s = document.createElement('script')
        s.src = 'https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js'
        s.async = true
        s.onload = () => resolve()
        s.onerror = () => resolve()
        document.head.appendChild(s)
      })
      return (window as any).LightweightCharts
    }
    load().then((LW: any) => {
      if (destroyed || !ref.current || !LW) return
      if (!chartRef.current) {
        chartRef.current = LW.createChart(ref.current, {
          height: 240,
          layout: { background: { color: '#0f0f0f' }, textColor: '#c9d1d9' },
          grid: { vertLines: { color: '#202020' }, horzLines: { color: '#202020' } },
          rightPriceScale: { borderColor: '#2a2a2a' },
          timeScale: {
            borderColor: '#2a2a2a',
            timeVisible: true,
            secondsVisible: false,
            tickMarkFormatter: (time: any) => {
              const t = typeof time === 'number' ? time * 1000 : time?.timestamp ? time.timestamp * 1000 : Date.now()
              const d = new Date(t)
              const hh = String(d.getHours()).padStart(2, '0')
              const mm = String(d.getMinutes()).padStart(2, '0')
              return `${hh}:${mm}`
            }
          },
          crosshair: { mode: 0 },
          localization: { locale: 'ko-KR' }
        })
        seriesRef.current = chartRef.current.addCandlestickSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderUpColor: '#16a34a',
          borderDownColor: '#dc2626',
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444'
        })
      }
      // Ensure chart fits within its card; optimize for mobile
      const resize = () => {
        if (!ref.current || !chartRef.current) return
        const w = Math.max(0, ref.current.clientWidth || 0)
        const isMobile = window.matchMedia('(max-width: 639.98px)').matches
        const h = isMobile ? 260 : 360
        try {
          if (typeof (chartRef.current as any).resize === 'function') {
            ;(chartRef.current as any).resize(w, h)
          } else {
            ;(chartRef.current as any).applyOptions({ width: w, height: h })
          }
        } catch {}
      }
      // initial size
      resize()
      // observe container resize
      let ro: any
      try {
        ro = new (window as any).ResizeObserver(() => resize())
        if (ref.current) ro.observe(ref.current)
      } catch {}
      if (data && data.length && seriesRef.current) {
        seriesRef.current.setData(data)
      }
      const cur: any = chartRef.current as any
      if (cur && cur._entryLines) {
        cur._entryLines.forEach((pl: any) => seriesRef.current?.removePriceLine(pl))
        cur._entryLines = []
      }
      const lines: any[] = []
      entries.forEach((e) => {
        const extra = `${e.leverage ? `x${e.leverage}` : ''}${e.size ? ` · ${e.size}` : ''}`.trim()
        const title = `${e.label} · ${e.side}${extra ? ` · ${extra}` : ''}`
        const pl = seriesRef.current?.createPriceLine({
          price: e.price,
          color: e.side === 'Long' ? '#34d399' : '#f87171',
          lineStyle: 2,
          lineWidth: hoveredId === e.id ? 3 : 1,
          axisLabelVisible: true,
          title
        })
        if (pl) lines.push(pl)
      })
      if (cur) cur._entryLines = lines
      // cleanup for resize observer created above
      return () => {
        try { (ro as any)?.disconnect?.() } catch {}
      }
    })
    return () => {
      destroyed = true
    }
  }, [symbol, entries, hoveredId, data])

  React.useEffect(() => {
    const LW: any = (window as any).LightweightCharts
    if (!LW || !seriesRef.current) return
    if (!data || data.length === 0) return
    seriesRef.current.setData(data)
  }, [data])

  return <div ref={ref} className="h-[260px] md:h-[360px] w-full max-w-full min-w-0 overflow-hidden bg-[#0f0f0f]" />
}

// SVG fallback candlestick chart (미사용 시 무시)
function PriceChart({
  symbol,
  entries,
  hoveredId,
  onPrice
}: {
  symbol: string
  entries: { id: string; label: string; price: number; side: 'Long' | 'Short'; leverage?: number; size?: number }[]
  hoveredId?: string
  onPrice?: (price: number) => void
}) {
  type Candle = { time: number; open: number; high: number; low: number; close: number }
  const [candles, setCandles] = React.useState<Candle[]>([])
  const w = 900,
    h = 240

  React.useEffect(() => {
    let ws: WebSocket | null = null
    const ch = symbol.toUpperCase()
    const abort = new AbortController()
    const load = async () => {
      try {
        const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(ch)}&interval=1m&limit=200`
        const r = await fetch(url, { signal: abort.signal })
        if (!r.ok) return
        const j: any[] = await r.json()
        const arr: Candle[] = Array.isArray(j)
          ? j.map((row) => ({
              time: Math.floor(Number(row[0]) / 1000),
              open: Number(row[1]),
              high: Number(row[2]),
              low: Number(row[3]),
              close: Number(row[4])
            }))
          : []
        if (arr.length) setCandles(arr)
      } catch {}
    }
    load()
    try {
      ws = new WebSocket(`wss://fstream.binance.com/ws/${ch.toLowerCase()}@kline_1m`)
      ws.onmessage = (ev) => {
        try {
          const j = JSON.parse(ev.data as string)
          const k = j?.k
          const open = Number(k?.o)
          const high = Number(k?.h)
          const low = Number(k?.l)
          const close = Number(k?.c)
          const t = Number(k?.t)
          if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close) || !Number.isFinite(t)) return
          if (onPrice) onPrice(close)
          const ts = Math.floor(t / 1000)
          setCandles((prev) => {
            if (!prev.length) return [{ time: ts, open, high, low, close }]
            const last = prev[prev.length - 1]
            if (last.time === ts) return [...prev.slice(0, -1), { time: ts, open, high, low, close }]
            return [...prev.slice(-199), { time: ts, open, high, low, close }]
          })
        } catch {}
      }
    } catch {}
    return () => {
      try { ws?.close() } catch {}
      abort.abort()
    }
  }, [symbol])

  const data = candles.length
    ? candles
    : Array.from({ length: 120 }, (_, i) => {
        const base = 100_000 + Math.sin(i / 6) * 200
        const o = base + (Math.random() - 0.5) * 30
        const c = o + (Math.random() - 0.5) * 60
        const h = Math.max(o, c) + Math.random() * 40
        const l = Math.min(o, c) - Math.random() * 40
        return { time: i, open: o, high: h, low: l, close: c }
      })

  const min = Math.min(...data.map((d) => d.low))
  const max = Math.max(...data.map((d) => d.high))
  const pad = (max - min) * 0.1 || 1
  const yMin = min - pad
  const yMax = max + pad
  const xStep = w / Math.max(1, data.length)
  const bodyWidth = Math.max(2, Math.min(12, xStep * 0.6))

  const yOf = (v: number) => h - ((v - yMin) / (yMax - yMin)) * h

  const entryLinesRaw = entries.map((e) => ({ e, y: yOf(e.price) }))
  const minGap = 24
  const sorted = [...entryLinesRaw].sort((a, b) => a.y - b.y)
  let lastY = -Infinity
  const positioned = sorted.map((it) => {
    let y = it.y
    if (y - lastY < minGap) y = lastY + minGap
    y = Math.min(h - 6, Math.max(6, y))
    lastY = y
    return { ...it, labelY: y }
  })
  const entryLines = entryLinesRaw.map((it) => {
    const found = positioned.find((p) => p.e.id === it.e.id) || { labelY: it.y }
    return { ...it, labelY: (found as any).labelY }
  })

  return (
    <div className="w-full overflow-x-auto">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="min-w-full">
        <rect x="0" y="0" width={w} height={h} fill="#0f0f0f" stroke="#202020" />
        {data.map((c, i) => {
          const x = i * xStep + xStep / 2
          const yOpen = yOf(c.open)
          const yClose = yOf(c.close)
          const yHigh = yOf(c.high)
          const yLow = yOf(c.low)
          const up = c.close >= c.open
          const color = up ? '#22c55e' : '#ef4444'
          const bodyTop = Math.min(yOpen, yClose)
          const bodyHeight = Math.max(1, Math.abs(yClose - yOpen))
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1} />
              <rect x={x - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} />
            </g>
          )
        })}
        {entryLines.map(({ e, y, labelY }) => {
          const extras = `${e.leverage ? `x${e.leverage}` : ''}${e.size ? ` · ${e.size}` : ''}`.trim()
          const label = `${e.label} · ${e.price.toLocaleString()}${extras ? ` · ${extras}` : ''}`
          const badge = e.side
          const fontSize = 12
          const approxWidth = Math.min(360, Math.max(160, label.length * 7))
          const badgeW = 46
          const rx = w - (approxWidth + badgeW) - 8
          const ty = Math.max(6, labelY - 10) + 12
          return (
            <g key={e.id}>
              <line
                x1={0}
                x2={w}
                y1={y}
                y2={y}
                stroke={e.side === 'Long' ? '#34d399' : '#f87171'}
                strokeDasharray="4 4"
                opacity={hoveredId === e.id ? 1 : 0.7}
                strokeWidth={hoveredId === e.id ? 2 : 1}
              />
              <rect
                x={rx}
                y={Math.max(6, labelY - 10)}
                rx={4}
                ry={4}
                height={16}
                width={badgeW}
                fill={e.side === 'Long' ? '#093b2a' : '#3a0a0a'}
                stroke={e.side === 'Long' ? '#22c55e' : '#ef4444'}
              />
              <text x={rx + 8} y={ty} fill="#f3f4f6" fontSize={fontSize} fontFamily="ui-sans-serif, system-ui">
                {badge}
              </text>
              <rect
                x={rx + badgeW + 4}
                y={Math.max(6, labelY - 10)}
                rx={4}
                ry={4}
                height={16}
                width={approxWidth}
                fill="#0e1113"
                stroke="#444444"
              />
              <text
                x={rx + badgeW + 12}
                y={ty}
                fill={e.side === 'Long' ? '#86efac' : '#fca5a5'}
                fontSize={fontSize}
                fontFamily="ui-sans-serif, system-ui"
              >
                {label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// 카드 UI (스타일/레이아웃 유지, 텍스트/필드만 신규 컬럼으로 매핑)
function PositionCard(props: PositionCardProps) {
  const {
    id,
    bjName,
    bjAvatar,
    symbol,
    side,
    leverage,
    qty,
    pnlUsd,
    entry,
    mark,
    liq,
    pnlKrw,
    pnlTag,
    online,
    onlineFor,
    spark,
    onHover,
    onLeave
  } = props
  const up = (pnlUsd || 0) >= 0
  return (
    <Card className="bg-[#141414] border-neutral-800" style={{ overflowAnchor: 'none' }} onMouseEnter={() => onHover && onHover(id)} onMouseLeave={() => onLeave && onLeave()}>
      {/* Mobile compact header (md 미만) */}
      <CardHeader className="md:hidden px-2 pt-2 pb-1">
        <div className="flex items-center gap-2">
          <img src={bjAvatar || 'https://i.pravatar.cc/64'} alt={bjName} className="w-8 h-8 rounded" />
          <div className="min-w-0 flex-1">
            <CardTitle className="text-xs leading-tight truncate">
              {bjName}
              <span className="ml-1 text-[10px] text-muted-foreground align-middle">
                {online ? 'ON' : 'OFF'}{onlineFor ? ` · ${onlineFor}` : ''}
              </span>
            </CardTitle>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[10px] text-muted-foreground">{symbol}</div>
            <div className={`${side === 'Long' ? 'text-emerald-400' : 'text-red-400'} text-xs font-semibold leading-none`}>
              {side}{leverage ? ` x${leverage}` : ''}
            </div>
          </div>
        </div>
      </CardHeader>
      {/* Desktop original header (md 이상) */}
      <CardHeader className="pb-2 hidden md:block">
        <div className="flex items-center gap-3">
          <img src={bjAvatar || 'https://i.pravatar.cc/64'} alt={bjName} className="w-12 h-12 rounded" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-neutral-600'}`} />
              <span className="text-sm text-muted-foreground">
                {online ? 'ON' : 'OFF'} {onlineFor ? `· ${onlineFor}` : ''}
              </span>
            </div>
            {/* BJ 이름 */}
            <CardTitle className="text-base leading-tight">{bjName}</CardTitle>
          </div>
          <div className="ml-auto text-right">
            {/* 코인 심볼 */}
            <div className="text-xs text-muted-foreground">{symbol}</div>
            {/* 포지션 (Long/Short + 레버리지) */}
            <div className={`${side === 'Long' ? 'text-emerald-400' : 'text-red-400'} text-sm font-semibold`}>
              {side}
              {leverage ? ` x${leverage}` : ''}
            </div>
          </div>
        </div>
      </CardHeader>
      {/* Mobile compact content (md 미만) */}
      <CardContent className="md:hidden px-2 pt-0 pb-2">
        {/* 2x2 정보 그리드: 수량 / P&L(+현재가) / 진입가 / 청산가 */}
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div>
            <div className="text-[11px] text-muted-foreground">수량</div>
            <div className="font-semibold tabular-nums whitespace-nowrap leading-tight">{fmtNum(qty)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">P&L</div>
            <div className={`${up ? 'text-emerald-400' : 'text-red-400'} font-semibold tabular-nums whitespace-nowrap leading-tight`}>{fmtUSD(pnlUsd)}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">현재가 {fmtUSD(mark)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">진입가</div>
            <div className="font-semibold tabular-nums whitespace-nowrap leading-tight">{fmtUSD(entry)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">청산가</div>
            <div className="font-semibold tabular-nums whitespace-nowrap leading-tight">{fmtUSD(liq)}</div>
          </div>
        </div>
        {/* 미니 스파크라인 (더 컴팩트) */}
        <div className="mt-1 h-[30px] w-full">
          <SparkLine data={spark || []} up={up} height={30} />
        </div>
      </CardContent>
      <CardContent className="hidden md:block">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {/* 수량 */}
          <div>
            <div className="text-muted-foreground">수량</div>
            <div className="font-semibold tabular-nums whitespace-nowrap">{fmtNum(qty)}</div>
          </div>
          {/* P&L(달러) + P&L(원화) + 태그 */}
          <div>
            <div className="text-muted-foreground">P&L(달러)</div>
            <div className={`${up ? 'text-emerald-400' : 'text-red-400'} font-semibold tabular-nums sm:whitespace-nowrap break-keep`}>{fmtUSD(pnlUsd)}</div>
            <div className="mt-1 text-xs flex items-center gap-2 flex-wrap sm:flex-nowrap min-w-0">
              <span className="text-muted-foreground">P&L(원화)</span>
              <span className={(up ? 'text-emerald-300' : 'text-red-300') + ' tabular-nums sm:whitespace-nowrap whitespace-normal break-keep leading-snug min-w-0 max-w-full'}>{fmtKRW(pnlKrw)}</span>
              <span className={`inline-flex items-center px-1.5 py-0.5 border text-[10px] whitespace-nowrap leading-none ${up ? 'border-emerald-600 text-emerald-300 bg-emerald-600/10' : 'border-red-600 text-red-300 bg-red-600/10'}`}>{pnlTag}</span>
            </div>
          </div>
          {/* 청산가 */}
          <div>
            <div className="text-muted-foreground">청산가</div>
            <div className="font-semibold tabular-nums whitespace-nowrap">{fmtUSD(liq)}</div>
          </div>
          {/* 진입가 */}
          <div>
            <div className="text-muted-foreground">진입가</div>
            <div className="font-semibold tabular-nums whitespace-nowrap">{fmtUSD(entry)}</div>
          </div>
          {/* 현재가 */}
          <div>
            <div className="text-muted-foreground">현재가</div>
            <div className="font-semibold tabular-nums whitespace-nowrap">{fmtUSD(mark)}</div>
          </div>
          {/* 기존 스파크라인 유지 */}
          <div className="flex items-center col-span-2 sm:col-span-1 w-full">
            <SparkLine data={spark || []} up={up} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function loadPositionsFromStorage(): Position[] | null {
  try {
    const raw = localStorage.getItem('positions_streamers_v1')
    if (!raw) return null
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr
  } catch {}
  return null
}
function savePositionsToStorage(list: Position[]) {
  try {
    localStorage.setItem('positions_streamers_v1', JSON.stringify(list))
  } catch {}
}
function demoPositions(): Position[] {
  const base = 101_949.4
  const mk = (d = 0) => Number((base * (1 + d)).toFixed(2))
  const mkSpark = (n = 60, s = base) => Array.from({ length: n }, (_, i) => s * (1 + Math.sin(i / 6) / 200 + (Math.random() - 0.5) / 500))
  const rows: Position[] = [
    {
      id: 'p1',
      streamer: { id: 's1', name: '호두', handle: '852hodoo', avatar: 'https://i.pravatar.cc/64?img=68', online: true, onlineFor: '13분' },
      symbol: 'BTCUSDT',
      side: 'Long',
      leverage: 10,
      size: 65,
      entry: 104_316.32,
      mark: mk(-0.0232),
      liq: 103_543.4,
      pnl: undefined,
      spark: mkSpark()
    },
    {
      id: 'p2',
      streamer: { id: 's2', name: '상어', avatar: 'https://i.pravatar.cc/64?img=12', online: true, onlineFor: '2분' },
      symbol: 'BTCUSDT',
      side: 'Short',
      leverage: 15,
      size: 54,
      entry: 103_989.4,
      mark: mk(0),
      liq: 112_365.4,
      pnl: undefined,
      spark: mkSpark()
    },
    {
      id: 'p3',
      streamer: { id: 's3', name: '캣츠', avatar: 'https://i.pravatar.cc/64?img=52', online: true, onlineFor: '13분' },
      symbol: 'BTCUSDT',
      side: 'Long',
      leverage: 8,
      size: 38,
      entry: 110_383.8,
      mark: mk(-0.0083),
      liq: 86_424.6,
      pnl: undefined,
      spark: mkSpark()
    },
    {
      id: 'p4',
      streamer: { id: 's4', name: '바나', avatar: 'https://i.pravatar.cc/64?img=25', online: true, onlineFor: '11분' },
      symbol: 'BTCUSDT',
      side: 'Short',
      leverage: 12,
      size: 15.53,
      entry: 108_578.23,
      mark: mk(-0.005),
      liq: 109_262.24,
      pnl: undefined,
      spark: mkSpark()
    }
  ]
  rows.forEach((r) => (r.pnl = computePnl(r)))
  return rows
}
