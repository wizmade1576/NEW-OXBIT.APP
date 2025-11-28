import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import ListItemCard from '../../components/ui/ListItemCard'
import { useAuthStore } from '@/store/useAuthStore'
import { createPortal } from 'react-dom'

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
  const SYMBOL_OPTIONS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LTCUSDT', 'ADAUSDT']
  const defaultSymbols = ['BTCUSDT']
  const [symbols, setSymbols] = React.useState<string[]>(defaultSymbols)
  const [events, setEvents] = React.useState<WhaleTrade[]>([])
  const [paused, setPaused] = React.useState(false)
  const [connected, setConnected] = React.useState(false)
  const lastConnected = React.useRef<boolean>(false)
  const [usdkrw, setUsdkrw] = React.useState<number>(0)
  const [thresholdKrw] = React.useState<number>(100_000_000)
  const lastEventId = React.useRef<string | null>(null)
  const [openSymbols, setOpenSymbols] = React.useState(false)
  const thresholdKrwRef = React.useRef<number>(thresholdKrw)
  const usdkrwRef = React.useRef<number>(usdkrw)
  const dropdownRef = React.useRef<HTMLDivElement | null>(null)

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
          usdkrwRef.current = rate
          try {
            localStorage.setItem(key, JSON.stringify({ rate, ts: Date.now() }))
          } catch {}
        }
      } catch {
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
    if (paused || symbols.length === 0) {
      setConnected(false)
      return
    }
    const stream = symbols.map((s) => `${s.toLowerCase()}@aggTrade`).join('/')
    const url = `wss://fstream.binance.com/stream?streams=${stream}`
    const ws = new WebSocket(url)
    ws.onopen = () => {
      if (!lastConnected.current) {
        lastConnected.current = true
        setConnected(true)
      }
    }
    ws.onclose = () => {
      if (lastConnected.current) {
        lastConnected.current = false
        setConnected(false)
      }
    }
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
        usdkrwRef.current = usdkrw || usdkrwRef.current || 1300
        const rate = usdkrwRef.current || 1300
        thresholdKrwRef.current = thresholdKrw
        const krw = usd * rate
        if (krw && krw < thresholdKrwRef.current) return
        const aggId = (d && (d.a ?? (d.A as any))) ?? Math.random()
        const newId = `${s}-${ts}-${String(aggId)}`
        if (lastEventId.current === newId) return
        lastEventId.current = newId
        const item: WhaleTrade = {
          id: newId,
          ts: ts,
          exchange: 'Binance',
          symbol: s,
          side: side,
          price: price,
          qty: qty,
          usd: usd,
        }
        setEvents((prev) => {
          if (prev.length && prev[0].id === item.id) return prev
          return [item, ...prev].slice(0, 300)
        })
      } catch {}
    }
    return () => {
      try {
        ws.close()
      } catch {}
    }
  }, [symbols, paused])

  React.useEffect(() => {
    if (!openSymbols) return
    // 데스크탑 드롭다운만 바깥 클릭 감지 (모바일 바텀시트는 overlay로 처리)
    const isMobile = window.matchMedia('(max-width: 639.98px)').matches
    if (isMobile) return
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (!dropdownRef.current) return
      if (dropdownRef.current.contains(e.target as Node)) return
      setOpenSymbols(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [openSymbols])

  const rate = usdkrw || 1300
  const thresholdUsd = Math.round(thresholdKrw / rate)

  const toggleSymbol = (sym: string) => {
    setSymbols((prev) => {
      if (prev.includes(sym)) {
        const next = prev.filter((s) => s !== sym)
        return next
      }
      return [...prev, sym]
    })
  }

  const closeSymbols = () => setOpenSymbols(false)

  React.useEffect(() => {
    if (openSymbols) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [openSymbols])

  return (
    <section className="space-y-6">
      {!user && showSignupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-[#0e1424] p-6 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold text-white">회원가입 안내</h3>
            <p className="mb-6 text-sm text-muted-foreground">서비스를 계속 이용하시려면 회원가입이 필요합니다.</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                onClick={() => navigate('/signup')}
              >
                회원가입하기
              </button>
              <button
                type="button"
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a2235]"
                onClick={() => navigate('/breaking')}
              >
                나중에 보기
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
              <div className="relative hidden sm:block" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setOpenSymbols((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-[#1a1a1a]/80 px-3 py-1.5 text-sm text-foreground"
                >
                  코인 선택 ({symbols.length})
                </button>
                {openSymbols ? (
                  <div className="absolute right-0 z-20 mt-2 w-52 rounded-md border border-neutral-700 bg-[#0f111a] p-2 shadow-xl">
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {SYMBOL_OPTIONS.map((sym) => {
                        const checked = symbols.includes(sym)
                        return (
                          <label key={sym} className="flex items-center gap-2 text-sm text-foreground px-2 py-1 rounded hover:bg-neutral-800">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSymbol(sym)}
                              className="accent-emerald-500"
                            />
                            <span>{sym}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="relative sm:hidden">
                <button
                  type="button"
                  onClick={() => setOpenSymbols((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-[#1a1a1a]/80 px-3 py-1.5 text-sm text-foreground"
                >
                  코인 선택 ({symbols.length})
                </button>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={!paused} onChange={(e) => setPaused(!e.target.checked)} /> ON
              </label>
              <span className="text-xs text-emerald-400">실시간 연결됨</span>
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
            {events.length === 0 ? <div className="text-sm text-muted-foreground">표시할 금액 이상의 이벤트가 없습니다.</div> : null}
          </div>
        </CardContent>
      </Card>

      {openSymbols
        ? createPortal(
            <div
              className="fixed inset-0 z-40 sm:hidden bg-black/60"
              onClick={closeSymbols}
            >
              <div
                className="absolute left-0 right-0 bottom-0 rounded-t-2xl bg-[#0f111a] border-t border-neutral-800 shadow-2xl max-h-[70vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                  <div className="text-sm font-semibold text-white">코인 선택 ({symbols.length})</div>
                  <button
                    type="button"
                    onClick={closeSymbols}
                    className="text-sm text-neutral-400 hover:text-white"
                  >
                    닫기
                  </button>
                </div>
            <div className="p-2 space-y-1 pb-24">
              {SYMBOL_OPTIONS.map((sym) => {
                const checked = symbols.includes(sym)
                return (
                  <label
                    key={sym}
                    className="flex items-center gap-3 text-sm text-foreground px-3 py-2 rounded-lg hover:bg-neutral-800 whitespace-normal break-words"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                          onChange={() => toggleSymbol(sym)}
                          className="accent-emerald-500 h-4 w-4"
                        />
                        <span className="font-semibold text-white">{sym}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  )
}
