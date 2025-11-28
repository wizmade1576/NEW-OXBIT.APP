import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'

type FGI = { value: number; value_classification: string; timestamp: number }

export default function FearGreedPage() {
  const [now, setNow] = React.useState<FGI | null>(null)
  const [yesterday, setYesterday] = React.useState<FGI | null>(null)
  const [lastWeek, setLastWeek] = React.useState<FGI | null>(null)
  const [history, setHistory] = React.useState<number[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [period, setPeriod] = React.useState<7|30|90|365|730>(30)
  const [trendUp, setTrendUp] = React.useState<boolean | null>(null)
  const [smooth, setSmooth] = React.useState<'none'|'ma3'|'ma7'|'ma14'>('ma3')

  React.useEffect(() => {
    let mounted = true
    const cacheKey = 'fng_cache_v1'
    try {
      const c = JSON.parse(localStorage.getItem(cacheKey) || 'null')
      if (c?.now) { setNow(c.now); setYesterday(c.yesterday); setLastWeek(c.lastWeek); setHistory(c.history||[]) }
    } catch {}
    const pull = async () => {
      try {
        const limit = period<=7 ? 8 : period
        const r = await fetch(`https://api.alternative.me/fng/?limit=${limit}&format=json`)
        if (!r.ok) throw new Error(String(r.status))
        const j = await r.json()
        const data = Array.isArray(j?.data) ? j.data : []
        if (data.length) {
          const map = (d: any): FGI => ({ value: Number(d.value), value_classification: String(d.value_classification), timestamp: Number(d.timestamp)*1000 })
          const nowV = map(data[0])
          const yV = data[1] ? map(data[1]) : null
          const wIndex = Math.min(7, data.length-1)
          const wV = data[wIndex] ? map(data[wIndex]) : null
          const hist = data.slice(0,period<=7?7:period).reverse().map((d:any)=>Number(d.value))
          if (mounted) {
            setTrendUp(() => (now && nowV ? nowV.value > now.value : null))
            setNow(nowV); setYesterday(yV); setLastWeek(wV); setHistory(hist); setError(null)
          }
          try { localStorage.setItem(cacheKey, JSON.stringify({ now: nowV, yesterday: yV, lastWeek: wV, history: hist, ts: Date.now() })) } catch {}
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'load error')
      }
    }
    pull()
    const id = setInterval(pull, 60*60*1000)
    return () => { mounted = false; clearInterval(id) }
  }, [period])

  const cls = now ? classificationColor(now.value) : 'text-muted-foreground'
  return (
    <section className="space-y-6">
      <Card className="bg-[#141414] border-neutral-800">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>공포/탐욕 지수</CardTitle>
              <CardDescription>크립토 시장 심리 (Fear & Greed Index)</CardDescription>
            </div>
            <div className="inline-flex rounded-md border border-neutral-700 overflow-hidden">
              {[7,30,90,365,730].map(p => (
                <button key={p} onClick={()=>setPeriod(p as 7|30|90)} className={`px-3 py-1.5 text-sm ${period===p?'bg-emerald-600/20 text-emerald-300':'bg-[#1a1a1a] hover:bg-[#1e1e1e]'}`}>{p}일</button>
              ))}
            </div>
            <select value={smooth} onChange={(e)=>setSmooth(e.target.value as any)} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm">
              <option value="none">스무딩 없음</option>
              <option value="ma3">MA(3)</option>
              <option value="ma7">MA(7)</option>
              <option value="ma14">MA(14)</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className={`flex h-24 w-24 items-center justify-center rounded-full text-3xl font-semibold border transition-colors duration-500 ${trendUp===true?'border-emerald-500 bg-[#0f1a14] text-emerald-300': trendUp===false?'border-red-500 bg-[#1a0f0f] text-red-300':'border-neutral-700 bg-[#1a1a1a] text-white'}`}>
                {now ? Math.round(now.value) : '--'}
              </div>
              <div className="text-sm">
                <div className={`font-semibold ${cls}`}>{now ? toKorean(now.value_classification) : '로딩 중'}</div>
                <div className="text-muted-foreground">현재: {now ? formatDate(now.timestamp) : '--'}</div>
                <div className="text-muted-foreground">어제: {yesterday ? `${yesterday.value} (${toKorean(yesterday.value_classification)})` : '--'}</div>
                <div className="text-muted-foreground">지난주: {lastWeek ? `${lastWeek.value} (${toKorean(lastWeek.value_classification)})` : '--'}</div>
                {error ? <div className="text-xs text-amber-300 mt-1">API 오류: {error}</div> : null}
              </div>
            </div>
            <div className="w-full sm:w-auto">
              <FGChart
                rawPoints={decimatePoints(buildSeries(period, history), 600)}
                maPoints={smooth==='none'? undefined : decimatePoints(buildSeries(period, movingAverage(history, smooth==='ma3'?3 : smooth==='ma7'?7 : 14)), 600)}
                hourMode={period<=7}
                up={(history[history.length-1]||0) >= (history[0]||0)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function classificationColor(v: number) {
  if (v <= 25) return 'text-red-400'
  if (v <= 45) return 'text-orange-400'
  if (v < 55) return 'text-gray-300'
  if (v < 75) return 'text-emerald-400'
  return 'text-emerald-300'
}
function toKorean(s: string) {
  const t = s.toLowerCase()
  if (t.includes('extreme fear')) return '극단적 공포'
  if (t.includes('fear')) return '공포'
  if (t.includes('extreme greed')) return '극단적 탐욕'
  if (t.includes('greed')) return '탐욕'
  return '중립'
}
function formatDate(ts: number) {
  const d = new Date(ts)
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const dd = String(d.getDate()).padStart(2,'0')
  const hh = String(d.getHours()).padStart(2,'0')
  const mi = String(d.getMinutes()).padStart(2,'0')
  return `${mm}/${dd} ${hh}:${mi}`
}
function FGChart({ rawPoints, maPoints, up, hourMode }: { rawPoints: { time: number; value: number }[]; maPoints?: { time: number; value: number }[]; up: boolean; hourMode?: boolean }) {
  const ref = React.useRef<HTMLDivElement|null>(null)
  const [loaded, setLoaded] = React.useState<boolean>(!!(window as any).LightweightCharts)
  React.useEffect(() => {
    if (!ref.current || !rawPoints || rawPoints.length===0) return
    const load = async () => {
      if ((window as any).LightweightCharts) return (window as any).LightweightCharts
      await new Promise<void>((resolve) => { const s=document.createElement('script'); s.src='https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js'; s.async=true; s.onload=()=>resolve(); s.onerror=()=>resolve(); document.head.appendChild(s) })
      return (window as any).LightweightCharts
    }
    let chart: any, area: any, ma: any, tooltip: HTMLDivElement | null = null
    let onResize: (() => void) | null = null
    load().then((LW:any)=>{
      if (!LW || !ref.current) return
      setLoaded(true)
      const container = ref.current!
      const getSize = () => ({ width: container.clientWidth || 360, height: container.clientHeight || 140 })
      const sz = getSize()
      chart = LW.createChart(container, {
        width: sz.width,
        height: sz.height,
        layout:{ background:{ color:'#0f0f0f' }, textColor:'#c9d1d9' },
        grid:{ vertLines:{color:'#202020'}, horzLines:{color:'#202020'} },
        rightPriceScale:{ visible:false },
        timeScale:{ visible:true, timeVisible: hourMode, secondsVisible:false, borderColor:'#2a2a2a' },
        localization: { locale: 'ko-KR' },
        crosshair: { mode: 0 },
      })
      area = chart.addAreaSeries({ lineColor: up?'#22c55e':'#ef4444', topColor: up?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.3)', bottomColor:'rgba(0,0,0,0)' })
      area.setData(rawPoints)
      if (maPoints && maPoints.length) {
        ma = chart.addLineSeries({ color:'#60a5fa', lineWidth:2 })
        ma.setData(maPoints)
      }
      onResize = () => {
        const s = getSize()
        try { chart.applyOptions({ width: s.width, height: s.height }) } catch {}
      }
      window.addEventListener('resize', onResize)
      // tooltip DOM
      tooltip = document.createElement('div')
      tooltip.style.position = 'absolute'
      tooltip.style.pointerEvents = 'none'
      tooltip.style.background = '#111827'
      tooltip.style.border = '1px solid #374151'
      tooltip.style.borderRadius = '6px'
      tooltip.style.padding = '6px 8px'
      tooltip.style.color = '#e5e7eb'
      tooltip.style.fontSize = '12px'
      tooltip.style.zIndex = '10'
      tooltip.style.transform = 'translate(-50%, -125%)'
      ref.current!.appendChild(tooltip)
      chart.subscribeCrosshairMove((param:any) => {
        if (!param?.point || !param.time) { tooltip!.style.display='none'; return }
        const p = param.point
        const time = param.time
        const raw = param.seriesPrices.get(area)
        const mav = ma ? param.seriesPrices.get(ma) : undefined
        tooltip!.innerHTML = `${hourMode? '시간':'일자'}: ${formatTooltipTime(time, hourMode)}<br/>지수: ${raw?.toFixed? raw.toFixed(0): raw}${mav? `<br/>MA: ${Number(mav).toFixed(0)}`:''}`
        tooltip!.style.left = `${p.x}px`
        tooltip!.style.top = `${p.y}px`
        tooltip!.style.display = 'block'
      })
    })
    return () => { try { chart?.remove() } catch {}; try { if (onResize) window.removeEventListener('resize', onResize) } catch {} }
  }, [JSON.stringify(rawPoints), JSON.stringify(maPoints), up, hourMode])
  if (!loaded) {
    // quick SVG fallback so 차트가 비지 않도록
    const w = 360, h = 140
    const values = rawPoints.map(p=>p.value)
    if (values.length===0) return <div className="w-full h-[160px] sm:h-[180px] bg-neutral-900 rounded" />
    const min = Math.min(...values), max = Math.max(...values)
    const range = max - min || 1
    const line = rawPoints.map((p,i)=>{
      const x = (i/(rawPoints.length-1))*w
      const y = h - ((p.value - min)/range)*h
      return `${x},${y}`
    }).join(' ')
    const stroke = up? '#22c55e':'#ef4444'
    return (
      <svg className="w-full h-[160px] sm:h-[180px]" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <polyline fill="none" stroke={stroke} strokeWidth="2" points={line} />
      </svg>
    )
  }
  return <div className="w-full h-[160px] sm:h-[180px]" ref={ref} />
}

function buildSeries(period: number, history: number[]) {
  let values = history.slice()
  const nowSec = Math.floor(Date.now()/1000)
  if (period<=7) {
    // synthesize hourly series by linear interpolation between daily points
    const hours: { time:number; value:number }[] = []
    for (let i=1;i<values.length;i++){
      const v0 = values[i-1]
      const v1 = values[i]
      for (let h=0; h<24; h++){
        const t = nowSec - ((values.length-1-i)*24 + (24-h)) * 3600
        const v = v0 + (v1 - v0) * (h/24)
        hours.push({ time: t, value: v })
      }
    }
    return hours
  }
  // daily points
  return values.map((v, idx) => ({ time: nowSec - (values.length-1-idx)*86400, value: v }))
}

function movingAverage(arr: number[], window: number) {
  const out: number[] = []
  for (let i=0;i<arr.length;i++){
    const s = Math.max(0, i-window+1)
    const slice = arr.slice(s, i+1)
    out.push(slice.reduce((a,b)=>a+b,0)/slice.length)
  }
  return out
}

function decimatePoints(points: {time:number; value:number}[], maxPts = 600) {
  if (points.length <= maxPts) return points
  const bucket = Math.ceil(points.length / maxPts)
  const out: {time:number; value:number}[] = []
  for (let i=0;i<points.length;i+=bucket){
    const slice = points.slice(i, i+bucket)
    const t = slice[Math.floor(slice.length/2)].time
    const v = slice.reduce((a,p)=>a+p.value,0)/slice.length
    out.push({ time:t, value:v })
  }
  return out
}

function formatTooltipTime(time:any, hourMode?: boolean) {
  const ts = typeof time === 'number' ? time*1000 : (time?.timestamp? time.timestamp*1000 : Date.now())
  const d = new Date(ts)
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const dd = String(d.getDate()).padStart(2,'0')
  const hh = String(d.getHours()).padStart(2,'0')
  const mi = String(d.getMinutes()).padStart(2,'0')
  return hourMode ? `${hh}:${mi}` : `${mm}/${dd}`
}
