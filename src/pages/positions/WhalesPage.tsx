import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import ListItemCard from '../../components/ui/ListItemCard'
import { useAuthStore } from '@/store/useAuthStore'

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

  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [showSignupModal, setShowSignupModal] = React.useState(false)
  React.useEffect(() => {
    if (user) return
    const id = window.setTimeout(() => setShowSignupModal(true), 30000)
    return () => clearTimeout(id)
  }, [user])

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
        // 네트워크 이슈 시 추정치 사용(실시간/필터 이상 방지 목적)
        if (mounted && !usdkrw) setUsdkrw(1300)
      }
    }
    pull()
    const id = setInterval(pull, 6 * 60 * 60 * 1000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [usdkrw])

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
        if (krw && krw < thresholdKrw) return // 기준 금액 미만은 제외
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
  }, [symbols, paused, usdkrw, thresholdKrw])

  const rate = usdkrw || 1300
  const thresholdUsd = Math.round(thresholdKrw / rate)

  return (
    <section className="space-y-6">
      {!user && showSignupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-[#0e1424] p-6 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold text-white">회원가입 안내</h3>
            <p className="mb-6 text-sm text-muted-foreground">서비스를 계속 이용 하실려면 회원가입이 필요합니다.</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                onClick={() => navigate('/signup')}
              >
                회원가입 하기
              </button>
              <button
                type="button"
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a2235]"
                onClick={() => navigate('/breaking')}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <Card className="bg-[#141414] border-neutral-800">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>고래 추적</CardTitle>
              <CardDescription>거래소 대규모 체결 · 기준 {thresholdKrw.toLocaleString()}원 이상</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="inline-flex rounded-md border border-neutral-700 bg-[#1a1a1a]/80 px-3 py-1.5 text-sm text-foreground">
                기준 {thresholdKrw.toLocaleString()}원
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={!paused} onChange={(e) => setPaused(!e.target.checked)} /> 실시간
              </label>
              <span className={`text-xs ${connected ? 'text-emerald-400' : 'text-red-400'}`}>{connected ? '연결됨' : '연결 끊김'}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground mb-2">
            기준 환율: {Math.round(rate).toLocaleString()}원/USD · USD 기준 ${thresholdUsd.toLocaleString()} 이상
          </div>
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
            {events.length === 0 ? <div className="text-sm text-muted-foreground">실시간 감지 금액 이상 이벤트가 없습니다.</div> : null}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
