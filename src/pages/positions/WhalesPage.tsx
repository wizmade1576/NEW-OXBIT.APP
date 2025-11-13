import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import ListItemCard from '../../components/ui/ListItemCard'

type WhaleTrade = {
  id: string
  ts: number
  exchange: 'Binance'
  symbol: string
  side: 'BUY' | 'SELL'
  price: number
  qty: number
  usd: number
}

export default function WhalesPage() {
  const defaultSymbols = ['btcusdt', 'ethusdt', 'solusdt', 'xrpusdt', 'dogeusdt', 'bchusdt']
  const [symbols] = React.useState<string[]>(defaultSymbols)
  const [events, setEvents] = React.useState<WhaleTrade[]>([])
  const [paused, setPaused] = React.useState(false)
  const [connected, setConnected] = React.useState(false)
  const [usdkrw, setUsdkrw] = React.useState<number>(0)
  const [thresholdKrw, setThresholdKrw] = React.useState<number>(100_000_000) // 1억 기본

  // FX: USD->KRW (cache + refresh, fallback)
  React.useEffect(() => {
    let mounted = true
    const key = 'usdkrw_cache_v1'
    try {
      const c = JSON.parse(localStorage.getItem(key) || 'null')
      if (c && typeof c.rate === 'number') setUsdkrw(c.rate)
    } catch {}
    const pull = async () => {
      try {
        const r = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=KRW')
        if (!r.ok) throw new Error('fx')
        const j = await r.json()
        const rate = j?.rates?.KRW
        if (mounted && typeof rate === 'number') {
          setUsdkrw(rate)
          try {
            localStorage.setItem(key, JSON.stringify({ rate, ts: Date.now() }))
          } catch {}
        }
      } catch {
        // 네트워크 이슈 시 임시 추정치 사용(표시/필터 정상화 목적)
        if (mounted && !usdkrw) setUsdkrw(1300)
      }
    }
    pull()
    const id = setInterval(pull, 6 * 60 * 60 * 1000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  // Binance Futures aggTrade stream
  React.useEffect(() => {
    if (paused || symbols.length === 0) return
    const stream = symbols.map((s) => `${s}@aggTrade`).join('/')
    const url = `wss://fstream.binance.com/stream?streams=${stream}`
    const ws = new WebSocket(url)
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data as string)
        const d = m?.data || m
        const s = String(d?.s || d?.symbol || '')
        const price = Number(d?.p)
        const qty = Number(d?.q)
        const usd = Number.isFinite(price) && Number.isFinite(qty) ? price * qty : 0
        const ts = Number(d?.T || d?.E || Date.now())
        const side: 'BUY' | 'SELL' = d?.m ? 'SELL' : 'BUY'
        if (!s || !usd || !ts) return
        const rate = usdkrw || 1300
        const krw = usd * rate
        if (krw && krw < thresholdKrw) return // 환율 기준 필터
        const aggId = (d && (d.a ?? (d.A as any))) ?? Math.random()
        const item: WhaleTrade = {
          id: `${s}-${ts}-${String(aggId)}`,
          ts: ts,
          exchange: 'Binance',
          symbol: s,
          side: side,
          price: price,
          qty: qty,
          usd: usd,
        }
        setEvents((prev) => [item, ...prev].slice(0, 500))
      } catch {}
    }
    return () => {
      try {
        ws.close()
      } catch {}
    }
  }, [symbols.join(','), paused, usdkrw, thresholdKrw])

  const rate = usdkrw || 1300
  const thresholdUsd = Math.round(thresholdKrw / rate)

  return (
    <section className="space-y-6">
      <Card className="bg-[#141414] border-neutral-800">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>고래 추적</CardTitle>
              <CardDescription>거래소 대규모 체결(선물 aggTrade) · 기준 {thresholdKrw.toLocaleString()}원 이상</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="inline-flex rounded-md border border-neutral-700 overflow-hidden">
                {[100_000_000, 500_000_000, 1_000_000_000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setThresholdKrw(v)}
                    className={`px-3 py-1.5 text-sm ${thresholdKrw === v ? 'bg-emerald-600/20 text-emerald-300' : 'bg-[#1a1a1a] hover:bg-[#1e1e1e]'}`}
                  >
                    {v === 100_000_000 ? '1억' : v === 500_000_000 ? '5억' : '10억'}
                  </button>
                ))}
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={!paused} onChange={(e) => setPaused(!e.target.checked)} /> 실시간
              </label>
              <span className={`text-xs ${connected ? 'text-emerald-400' : 'text-red-400'}`}>{connected ? '실시간 연결됨' : '연결 끊김'}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground mb-2">기준 환율: {Math.round(rate).toLocaleString()}원/USD · USD 기준 약 ${thresholdUsd.toLocaleString()} 이상</div>
          <div className="space-y-3">
            {events.map((ev) => (
              <ListItemCard
                key={ev.id}
                title={`${ev.symbol.toUpperCase()} ${ev.side === 'BUY' ? '매수' : '매도'}`}
                description={`$${ev.usd.toLocaleString()} · ${ev.qty.toLocaleString()} @ ${ev.price.toLocaleString()}`}
                metaLeft={`${new Date(ev.ts).toLocaleTimeString()} · ${ev.exchange}`}
                rightSlot={<span className={ev.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>{Math.round(ev.usd * rate).toLocaleString()}원</span>}
              />
            ))}
            {events.length === 0 ? <div className="text-sm text-muted-foreground">실시간 중 기준 금액 이상 이벤트가 없습니다.</div> : null}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
