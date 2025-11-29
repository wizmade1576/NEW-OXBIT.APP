import * as React from "react"
import { useAuthStore } from "@/store/useAuthStore"

type ChatMessage = {
  id: string
  user: string
  badge?: string
  text: string
  time: string
}

type Profile = {
  name: string
  badge?: string
  weight: number
}

const PROFILES: Profile[] = [
  { name: "준배87", badge: "TOS", weight: 3 },
  { name: "공포에 살아야지", weight: 2 },
  { name: "익절", weight: 2 },
  { name: "바운스토론", weight: 2 },
  { name: "자야겠다", weight: 1 },
  { name: "에이더", weight: 2 },
  { name: "스캘퍼", weight: 2 },
  { name: "김프워치", badge: "BOT", weight: 1 },
  { name: "롱숏헌터", badge: "BOT", weight: 1 },
]

const SEED_MESSAGES: ChatMessage[] = [
  { id: "seed1", user: "준배87", badge: "TOS", text: "없는데", time: "07:30" },
  { id: "seed2", user: "공포에 살아야지", text: "공포에 샀어야지", time: "07:30" },
  { id: "seed3", user: "익절", text: "너무 빠른 익절이었나 ㅇㅅㅇ?", time: "07:31" },
  { id: "seed4", user: "바운스토론", text: "심상치 않다", time: "07:31" },
  { id: "seed5", user: "자야겠다", text: "자야겠다 ㅅㅂ ㅋㅋ", time: "07:32" },
  { id: "seed6", user: "에이더", text: "에이더 떡상을 기원하면서...", time: "07:32" },
]

const PRICE_TEMPLATES = {
  strongUp: ["방금 세게 당기네요", "위로 쏘네요"],
  mildUp: ["살짝 올라오네요", "천천히 올리나요?"],
  flat: ["횡보 느낌?", "눈치게임인가요?"],
  mildDown: ["눌림 오나요?", "살짝 식네요"],
  strongDown: ["확 눌리네요", "윗꼬리 정리인가요?"],
}

const VOLUME_TEMPLATES = ["거래량 붙네요", "체결이 좀 붙는 듯"]
const FUNDING_TEMPLATES = ["펀딩 세네요", "펀딩 부담 생기는 듯"]
const LONGSHORT_TEMPLATES = ["숏/롱 쏠림 보이네요", "한쪽으로 기우네요"]

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const weightedPick = (profiles: Profile[]): Profile => {
  const total = profiles.reduce((sum, p) => sum + p.weight, 0)
  const r = Math.random() * total
  let acc = 0
  for (const p of profiles) {
    acc += p.weight
    if (r <= acc) return p
  }
  return profiles[0]
}

export default function OChatPage() {
  const user = useAuthStore((s) => s.user)
  const [messages, setMessages] = React.useState<ChatMessage[]>(SEED_MESSAGES)
  const [input, setInput] = React.useState("")

  const cooldownRef = React.useRef({
    strongUp: 0,
    strongDown: 0,
    funding: 0,
    longshort: 0,
  })
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const marketRef = React.useRef<
    { symbol: string; chg: number; vol: number; prevVol?: number; volChg: number }[]
  >([])
  const longShortRef = React.useRef<number>(0)

  const addMessage = React.useCallback((text: string, badge?: string) => {
    const profile = weightedPick(PROFILES)
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, "0")
    const mm = String(now.getMinutes()).padStart(2, "0")
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setMessages((prev) => [...prev.slice(-180), { id, user: profile.name, badge: badge ?? profile.badge, text, time: `${hh}:${mm}` }])
  }, [])

  const scheduleNext = React.useCallback(() => {
    const delay = 5000 + Math.random() * 15000 // 5~20초
    timeoutRef.current = setTimeout(() => {
      const now = Date.now()
      const markets = marketRef.current
      const pickSym = markets.length ? markets[Math.floor(Math.random() * markets.length)] : undefined
      const chg = pickSym ? pickSym.chg : (Math.random() - 0.5) * 6
      const volChg = pickSym ? pickSym.volChg : (Math.random() - 0.5) * 40
      const longShortDelta = longShortRef.current || (Math.random() - 0.5) * 20
      const fundingAbs = 0 // 펀딩은 사용 안 함

      const cd = cooldownRef.current
      const canFire = (key: keyof typeof cd, ms: number) => now - cd[key] > ms

      // 가격 분기
      if (chg >= 2 && canFire("strongUp", 150000)) {
        addMessage(pick(PRICE_TEMPLATES.strongUp))
        cd.strongUp = now
      } else if (chg >= 0.5) {
        addMessage(pick(PRICE_TEMPLATES.mildUp))
      } else if (chg > -0.5 && chg < 0.5) {
        addMessage(pick(PRICE_TEMPLATES.flat))
      } else if (chg > -2) {
        addMessage(pick(PRICE_TEMPLATES.mildDown))
      } else if (canFire("strongDown", 150000)) {
        addMessage(pick(PRICE_TEMPLATES.strongDown))
        cd.strongDown = now
      }

      // 거래량
      if (Math.abs(volChg) > 15) {
        addMessage(pick(VOLUME_TEMPLATES))
      }

      // 펀딩 (미사용)
      if (fundingAbs > 0.01 && canFire("funding", 180000)) {
        addMessage(pick(FUNDING_TEMPLATES), "BOT")
        cd.funding = now
      }

      // 롱숏
      if (Math.abs(longShortDelta) > 8 && canFire("longshort", 180000)) {
        addMessage(pick(LONGSHORT_TEMPLATES), "BOT")
        cd.longshort = now
      }

      scheduleNext()
    }, delay)
  }, [addMessage])

  React.useEffect(() => {
    scheduleNext()
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [scheduleNext])

  // 가격/거래대금 폴링
  React.useEffect(() => {
    let mounted = true
    const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT"]
    const fetchMarket = async () => {
      try {
        const resps = await Promise.all(
          symbols.map((sym) =>
            fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(sym)}`).then((r) => r.json())
          )
        )
        if (!mounted) return
        const prev = marketRef.current
        const next = resps
          .map((j: any, idx) => {
            const symbol = symbols[idx]
            const chg = Number(j?.priceChangePercent ?? 0)
            const vol = Number(j?.quoteVolume ?? 0)
            const prevVol = prev.find((p) => p.symbol === symbol)?.vol ?? vol
            const volChg = prevVol ? ((vol - prevVol) / prevVol) * 100 : 0
            return { symbol, chg, vol, prevVol: vol, volChg }
          })
          .filter((d) => Number.isFinite(d.chg) && Number.isFinite(d.vol))
        marketRef.current = next
      } catch {
        // ignore
      }
    }
    fetchMarket()
    const id = setInterval(fetchMarket, 20000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  // 롱숏 비율 폴링
  React.useEffect(() => {
    let mounted = true
    const fetchLongShort = async () => {
      try {
        const r = await fetch(
          "https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1"
        )
        if (!r.ok) return
        const j: any[] = await r.json()
        const row = Array.isArray(j) ? j[0] : null
        const ratio = Number(row?.longShortRatio ?? 0)
        if (mounted && Number.isFinite(ratio)) {
          longShortRef.current = (ratio - 1) * 100
        }
      } catch {
        // ignore
      }
    }
    fetchLongShort()
    const id = setInterval(fetchLongShort, 30000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  const handleSend = () => {
    if (!input.trim()) return
    if (!user) {
      alert("회원만 채팅을 보낼 수 있습니다. 로그인/회원가입 해주세요.")
      return
    }
    addMessage(input.trim())
    setInput("")
  }

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-black/80">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-blue-500 px-3 py-1 text-sm font-bold text-white">CHAT</div>
          <button className="text-sm font-semibold text-blue-400 inline-flex items-center gap-1">
            기본 채널 <span>▼</span>
          </button>
        </div>
        <div className="flex items-center gap-2 text-neutral-400">
          <button title="새로고침" className="hover:text-white">⟳</button>
          <button title="삭제" className="hover:text-white">🗑</button>
          <button title="설정" className="hover:text-white">⚙</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-[#0f1115]">
        {messages.map((m) => (
          <div key={m.id} className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span className="font-semibold text-white">{m.user}</span>
              {m.badge ? (
                <span className="rounded-full bg-neutral-700 px-1.5 py-[1px] text-[11px] text-neutral-200">{m.badge}</span>
              ) : null}
              <span className="text-neutral-500">{m.time}</span>
            </div>
            <div className="text-sm leading-snug text-neutral-200">{m.text}</div>
          </div>
        ))}
        {messages.length === 0 ? (
          <div className="text-sm text-neutral-500">메시지가 없습니다.</div>
        ) : null}
      </div>

      <div className="border-t border-neutral-800 bg-black/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="채팅방 공사중 입니다."
            className="flex-1 rounded-md bg-[#1b1b1b] border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={handleSend}
            className="rounded-md bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-400"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  )
}
