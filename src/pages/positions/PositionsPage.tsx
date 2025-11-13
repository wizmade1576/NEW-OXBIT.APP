import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'

type Streamer = {
  id: string
  name: string
  handle?: string
  avatar?: string
  online?: boolean
  onlineFor?: string // 예) '13분'
}

type Position = {
  id: string
  streamer: Streamer
  symbol: string
  side: 'Long' | 'Short'
  leverage?: number
  size?: number // 계약/코인 수
  entry: number
  mark: number
  liq: number
  pnl?: number // 미실현 손익(USD)
  spark?: number[]
}

export default function PositionsPage() {
  // 추후 관리자 페이지 연동 전까지: localStorage + 데모 데이터
  const [list, setList] = React.useState<Position[]>(() => loadPositionsFromStorage() || demoPositions())
  const [query, setQuery] = React.useState('')
  const [onlyOnline, setOnlyOnline] = React.useState(false)
  const symbols = React.useMemo(() => Array.from(new Set(list.map((p) => p.symbol))), [list])
  const [symbol, setSymbol] = React.useState<string>(() => symbols[0] || 'BTCUSDT')
  const [showEntries, setShowEntries] = React.useState(true)
  const [hoveredId, setHoveredId] = React.useState<string | undefined>(undefined)
  const [smooth, setSmooth] = React.useState<'raw' | 'ma5' | 'ma15'>('ma5')

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
      <Card className="bg-[#141414] border-neutral-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>실시간 가격 차트</CardTitle>
              <CardDescription>{symbol} 최근 흐름 · 스트리머 진입가</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="inline-flex rounded-md border border-neutral-700 overflow-hidden">
                {symbols.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSymbol(s)}
                    className={`px-3 py-1.5 text-sm ${symbol === s ? 'bg-emerald-600/20 text-emerald-300' : 'bg-[#1a1a1a] hover:bg-[#1e1e1e]'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={showEntries} onChange={(e) => setShowEntries(e.target.checked)} /> 진입선 표시
              </label>
              <select
                value={smooth}
                onChange={(e) => setSmooth(e.target.value as any)}
                className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm"
              >
                <option value="raw">원시(1초)</option>
                <option value="ma5">5초 평균</option>
                <option value="ma15">15초 평균</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PriceChartLW
            symbol={symbol}
            entries={
              showEntries
                ? list
                    .filter((p) => p.symbol === symbol)
                    .map((p) => ({ id: p.id, label: p.streamer.name, price: p.entry, side: p.side, leverage: p.leverage, size: p.size }))
                : []
            }
            hoveredId={hoveredId}
            smooth={smooth}
            onPrice={(price) => {
              setList((prev) => prev.map((p) => (p.symbol === symbol ? { ...p, mark: price, pnl: computePnl({ ...p, mark: price }) } : p)))
            }}
          />
        </CardContent>
      </Card>

      {/* 검색 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="검색(예: BTC, 박호두)"
          className="px-3 py-2 rounded border border-neutral-700 bg-[#1a1a1a] text-sm"
        />
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={onlyOnline} onChange={(e) => setOnlyOnline(e.target.checked)} /> ON만 보기
        </label>
        <button
          onClick={() => savePositionsToStorage(list)}
          className="ml-auto px-3 py-1.5 rounded border border-neutral-700 bg-[#1a1a1a] hover:bg-[#1e1e1e] text-sm"
        >
          상태 저장
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {displayed.map((p) => (
          <Card
            key={p.id}
            className="bg-[#141414] border-neutral-800"
            onMouseEnter={() => setHoveredId(p.id)}
            onMouseLeave={() => setHoveredId(undefined)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <img src={p.streamer.avatar || 'https://i.pravatar.cc/64'} alt={p.streamer.name} className="w-12 h-12 rounded" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${p.streamer.online ? 'bg-emerald-500' : 'bg-neutral-600'}`} />
                    <span className="text-sm text-muted-foreground">
                      {p.streamer.online ? 'ON' : 'OFF'} {p.streamer.onlineFor ? `· ${p.streamer.onlineFor}` : ''}
                    </span>
                  </div>
                  <CardTitle className="text-base leading-tight">
                    {p.streamer.name}
                    {p.streamer.handle ? ` (${p.streamer.handle})` : ''}
                  </CardTitle>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-xs text-muted-foreground">{p.symbol}</div>
                  <div className={`${p.side === 'Long' ? 'text-emerald-400' : 'text-red-400'} text-sm font-semibold`}>
                    {p.side}
                    {p.leverage ? ` x${p.leverage}` : ''}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">규모</div>
                  <div className="font-semibold">{fmtNum(p.size)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">미실현 손익</div>
                  <div className={`${(p.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'} font-semibold`}>{fmtUSD(p.pnl)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">청산가</div>
                  <div className="font-semibold">{fmtUSD(p.liq)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">진입가</div>
                  <div className="font-semibold">{fmtUSD(p.entry)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">마크 가격</div>
                  <div className="font-semibold">{fmtUSD(p.mark)}</div>
                </div>
                <div className="flex items-center">
                  <SparkLine data={p.spark || []} up={(p.pnl || 0) >= 0} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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

function SparkLine({ data, up }: { data: number[]; up: boolean }) {
  if (!data || data.length === 0) return <div className="h-6 w-24 bg-neutral-800 rounded" />
  const w = 120,
    h = 36
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
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline fill="none" stroke={stroke} strokeWidth="2" points={points} />
    </svg>
  )
}

// 상단 메인 차트(Lightweight Charts 사용, 실패 시 SVG 대체)
function PriceChartLW({
  symbol,
  entries,
  hoveredId,
  smooth = 'ma5',
  onPrice
}: {
  symbol: string
  entries: { id: string; label: string; price: number; side: 'Long' | 'Short'; leverage?: number; size?: number }[]
  hoveredId?: string
  smooth?: 'raw' | 'ma5' | 'ma15'
  onPrice?: (price: number) => void
}) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const chartRef = React.useRef<any>(null)
  const seriesRef = React.useRef<any>(null)
  const [points, setPoints] = React.useState<number[]>([])

  // load data via WS
  React.useEffect(() => {
    let ws: WebSocket | null = null
    const ch = symbol.toLowerCase()
    try {
      ws = new WebSocket(`wss://fstream.binance.com/ws/${ch}@markPrice@1s`)
      ws.onmessage = (ev) => {
        try {
          const j = JSON.parse(ev.data as string)
          const p = Number(j?.p || j?.markPrice)
          if (!Number.isFinite(p)) return
          if (onPrice) onPrice(p)
          setPoints((prev) => [...prev.slice(-299), p])
        } catch {}
      }
    } catch {}
    return () => {
      try {
        ws?.close()
      } catch {}
    }
  }, [symbol])

  const smoothed = React.useMemo(() => {
    const N = smooth === 'ma15' ? 15 : smooth === 'ma5' ? 5 : 1
    if (N <= 1) return points
    const out: number[] = []
    for (let i = 0; i < points.length; i++) {
      const s = Math.max(0, i - N + 1)
      const window = points.slice(s, i + 1)
      out.push(window.reduce((a, b) => a + b, 0) / window.length)
    }
    return out
  }, [points, smooth])

  // try to render via Lightweight Charts from CDN
  React.useEffect(() => {
    let destroyed = false
    const load = async () => {
      if ((window as any).LightweightCharts) return (window as any).LightweightCharts
      await new Promise<void>((resolve) => {
        const s = document.createElement('script')
        s.src = 'https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js'
        s.async = true
        s.onload = () => resolve()
        s.onerror = () => resolve() // fallback silently
        document.head.appendChild(s)
      })
      return (window as any).LightweightCharts
    }
    load().then((LW: any) => {
      if (destroyed || !ref.current || !LW) return
      // init chart once
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
              // time is UTCTimestamp (seconds)
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
        seriesRef.current = chartRef.current.addLineSeries({ color: '#60a5fa', lineWidth: 2 })
      }
      // draw entries as price lines (axis label shows 이름 · Long/Short)
      chartRef.current?.priceScale('right').applyOptions({})
      // remove old price lines
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
    })
    return () => {
      destroyed = true
    }
  }, [symbol, entries, hoveredId])

  // update series data
  React.useEffect(() => {
    const LW: any = (window as any).LightweightCharts
    if (!LW || !seriesRef.current) return
    const now = Math.floor(Date.now() / 1000)
    const data = smoothed.map((v, i) => ({ time: now - (smoothed.length - 1 - i), value: v }))
    seriesRef.current.setData(data)
  }, [smoothed])

  // fallback SVG if library not loaded yet
  if (!(window as any).LightweightCharts) {
    return <PriceChart symbol={symbol} entries={entries} hoveredId={hoveredId} onPrice={onPrice} />
  }
  return <div ref={ref} />
}

// SVG fallback chart (simple)
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
  const [points, setPoints] = React.useState<number[]>([])
  const w = 900,
    h = 240
  React.useEffect(() => {
    let ws: WebSocket | null = null
    const ch = symbol.toLowerCase()
    try {
      ws = new WebSocket(`wss://fstream.binance.com/ws/${ch}@markPrice@1s`)
      ws.onmessage = (ev) => {
        try {
          const j = JSON.parse(ev.data as string)
          const p = Number(j?.p || j?.markPrice)
          if (!Number.isFinite(p)) return
          if (onPrice) onPrice(p)
          setPoints((prev) => [...prev.slice(-239), p])
        } catch {}
      }
    } catch {}
    return () => {
      try {
        ws?.close()
      } catch {}
    }
  }, [symbol])
  const data = points.length ? points : Array.from({ length: 120 }, (_, i) => 100_000 + Math.sin(i / 6) * 200 + Math.random() * 50)
  const min = Math.min(...data),
    max = Math.max(...data)
  const pad = (max - min) * 0.1 || 1
  const yMin = min - pad,
    yMax = max + pad
  const toXY = (v: number, i: number) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - yMin) / (yMax - yMin)) * h
    return `${x},${y}`
  }
  const line = data.map((v, i) => toXY(v, i)).join(' ')
  const entryLinesRaw = entries.map((e) => ({ e, y: h - ((e.price - yMin) / (yMax - yMin)) * h }))
  // label overlap avoidance (only affects label y, not the price line)
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
  // Map back to original order for drawing lines
  const entryLines = entryLinesRaw.map((it) => {
    const found = positioned.find((p) => p.e.id === it.e.id) || { labelY: it.y }
    return { ...it, labelY: (found as any).labelY }
  })
  return (
    <div className="w-full overflow-x-auto">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="min-w-full">
        <rect x="0" y="0" width={w} height={h} fill="#0f0f0f" stroke="#202020" />
        <polyline fill="none" stroke="#60a5fa" strokeWidth="2" points={line} />
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
              {/* badge */}
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
              {/* label */}
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
      streamer: { id: 's1', name: '박호두', handle: '852hodoo', avatar: 'https://i.pravatar.cc/64?img=68', online: true, onlineFor: '13분' },
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
      streamer: { id: 's2', name: '이유진', avatar: 'https://i.pravatar.cc/64?img=12', online: true, onlineFor: '2분' },
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
      streamer: { id: 's3', name: '코인튜브', avatar: 'https://i.pravatar.cc/64?img=52', online: true, onlineFor: '13분' },
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
      streamer: { id: 's4', name: '한또', avatar: 'https://i.pravatar.cc/64?img=25', online: true, onlineFor: '11분' },
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
  // 초기 PnL 계산
  rows.forEach((r) => (r.pnl = computePnl(r)))
  return rows
}

