import * as React from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card"
import getSupabase from "../../lib/supabase/client"

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
  side: "Long" | "Short"
  leverage?: number
  size?: number
  entry: number
  mark: number
  liq: number
  pnl?: number
  spark?: number[]
}

type PositionCardProps = {
  id: string
  bjName: string
  bjAvatar?: string
  symbol: string
  side: "Long" | "Short"
  leverage?: number
  qty?: number
  pnlUsd?: number
  entry: number
  mark: number
  liq: number
  pnlKrw?: number
  online?: boolean
  onlineFor?: string
  spark?: number[]
  onHover?: (id: string) => void
  onLeave?: () => void
  onDelete?: () => void
  isRisk?: boolean
}

const fmtUSD = (v?: number) => {
  if (!Number.isFinite(v as number)) return "--"
  return "$" + (v as number).toLocaleString("en-US", { maximumFractionDigits: 2 })
}
const fmtNum = (v?: number) => {
  if (!Number.isFinite(v as number)) return "--"
  const num = v as number
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const fmtKRW = (v?: number) => {
  if (!Number.isFinite(v as number)) return "--"
  return "₩" + Math.round(v as number).toLocaleString("ko-KR")
}

const PositionCard = React.memo(function PositionCardInner({
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
  online,
  spark,
  isRisk,
  onHover,
  onLeave,
  onDelete,
}: PositionCardProps) {
  const up = (pnlUsd || 0) >= 0
  const showCardSpark = false
  const cardTone = isRisk ? "bg-[#2a0f15] border-red-500/60" : "bg-[#12131f] border border-neutral-800"

  return (
    <Card className={cardTone} onMouseEnter={() => onHover?.(id)} onMouseLeave={() => onLeave?.()}>
      <CardHeader className="grid grid-cols-[auto_auto] items-start gap-3 w-full">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={bjAvatar || "https://i.pravatar.cc/40"}
            alt={bjName}
            className="h-10 w-10 rounded-full border border-border object-cover"
          />
          <div className="flex flex-col">
            <div className="text-sm font-semibold text-white">{bjName}</div>
            <div className="text-xs text-muted-foreground">{symbol}</div>
          </div>
        </div>

        <div className="flex flex-col items-end leading-tight whitespace-nowrap justify-start self-start justify-self-end gap-1">
          {isRisk ? (
            <span className="inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-200">
              청산주의
            </span>
          ) : null}
          <span className={side === "Long" ? "text-emerald-400" : "text-rose-400"}>{side}</span>
          {leverage ? <span className="text-emerald-400 font-semibold">{`x${leverage}`}</span> : null}
          <div className="text-xs text-muted-foreground">{online ? "ON" : "OFF"}</div>
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-3 gap-3 text-sm text-white">
        {[
          { label: "진입가",value: fmtNum(entry) },
          { label: "현재가", value: fmtNum(mark) },
          {
            label: "청산가",
            value: fmtNum(liq),
            className: "text-amber-400",
          },
        ].map((item) => (
          <div key={item.label}>
            <div className="text-xs text-muted-foreground">{item.label}</div>
            <div className={`font-semibold ${item.className || ""}`.trim()}>{item.value}</div>
          </div>
        ))}
      </CardContent>

      <CardContent className="grid grid-cols-3 gap-3 text-sm text-white">
        <div>
          <div className="text-xs text-muted-foreground">수량</div>
          <div className="font-semibold">{qty ?? "--"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">P&L</div>
          <div className={`font-semibold ${up ? "text-emerald-400" : "text-rose-400"}`}>{fmtUSD(pnlUsd)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">KRW</div>
          <div className={`font-semibold ${up ? "text-emerald-300" : "text-rose-300"}`}>{fmtKRW(pnlKrw)}</div>
        </div>
      </CardContent>

      {showCardSpark && spark && spark.length > 1 ? (
        <CardContent>
          <SparkLine data={spark} up={up} />
        </CardContent>
      ) : null}

      {onDelete ? (
        <CardContent>
          <button onClick={onDelete} className="text-xs text-red-400 underline">
            삭제
          </button>
        </CardContent>
      ) : null}
    </Card>
  )
})

export default function PositionsPage() {
  const [list, setList] = React.useState<Position[]>([])
  const [query, setQuery] = React.useState("")
  const [onlyOnline, setOnlyOnline] = React.useState(false)

  const symbols = React.useMemo(() => Array.from(new Set(list.map((p) => p.symbol))), [list])
  const availableSymbols = React.useMemo(
    () =>
      Array.from(
        new Set([
          ...symbols,
          "BTCUSDT",
          "ETHUSDT",
          "SOLUSDT",
          "XRPUSDT",
          "BNBUSDT",
          "DOGEUSDT",
          "ADAUSDT",
          "AVAXUSDT",
          "TRXUSDT",
          "DOTUSDT",
        ])
      ),
    [symbols]
  )

  const [symbol, setSymbol] = React.useState<string>(() => symbols[0] || "BTCUSDT")
  const [showEntries, setShowEntries] = React.useState(true)
  const [hoveredId, setHoveredId] = React.useState<string | undefined>(undefined)
  const [timeframe, setTimeframe] = React.useState<"1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w" | "1M">("1h")
  const [loading, setLoading] = React.useState(false)

  const [adminForm, setAdminForm] = React.useState({
    symbol: "BTCUSDT",
    side: "Long" as "Long" | "Short",
    leverage: "1",
    qty: "",
    entry: "",
    mark: "",
    liq: "",
    pnlUsd: "",
    pnlKrw: "",
    status: "on" as "on" | "off",
    streamerName: "관리자",
  })
  const [adminNotice, setAdminNotice] = React.useState<string | null>(null)
  const [adminError, setAdminError] = React.useState<string | null>(null)
  const [adminLoading, setAdminLoading] = React.useState(false)

  // Supabase fetch 빈도 조절 및 중복 setState 방지
  const lastFetchRef = React.useRef(0)
  const lastSigRef = React.useRef<string>("")
  const realtimeDebounceRef = React.useRef<NodeJS.Timeout | null>(null)

  const handleAdminChangeNumeric = React.useCallback(
    (field: keyof Pick<typeof adminForm, "entry" | "mark" | "liq" | "pnlUsd" | "pnlKrw" | "qty">, value: string) => {
      const normalized = value.replace(/[^0-9.]/g, "")
      const withSingleDot = normalized.includes(".") ? normalized.replace(/\.(?=.*\.)/g, "") : normalized
      setAdminForm((prev) => ({ ...prev, [field]: withSingleDot }))
    },
    []
  )

  const handleAdminAppend = React.useCallback(
    (field: keyof Pick<typeof adminForm, "entry" | "mark" | "liq" | "pnlUsd" | "pnlKrw" | "qty">, symbol: "." | ",") => {
      setAdminForm((prev) => {
        const current = prev[field] || ""
        if (symbol === "." && current.includes(".")) return prev
        return { ...prev, [field]: current + symbol }
      })
    },
    []
  )

  const showAdminPanel = import.meta.env.VITE_SHOW_ADMIN_POSITIONS === "true"

  const fetchPositions = React.useCallback(
    async (opts?: { force?: boolean }) => {
      const now = Date.now()
      if (!opts?.force && now - lastFetchRef.current < 20000) return
      lastFetchRef.current = now

      const supabase = getSupabase()
      if (!supabase) return
      setLoading((prev) => (prev ? prev : true))
      try {
        const { data, error } = await supabase.from("positions").select("*").order("updated_at", { ascending: false })
        if (error) throw error
        const normalized = (data || []).map(mapSupabaseToPosition)
        const sig = normalized.map((p) => `${p.id}-${p.mark}-${p.pnl}-${p.side}-${p.size}-${p.entry}`).join("|")
        if (sig === lastSigRef.current) return
        lastSigRef.current = sig
        setList(normalized)
      } catch (error) {
        console.error("[PositionsPage] fetch error", error)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const handleDelete = React.useCallback(
    async (id: string) => {
      if (!window.confirm("이 포지션을 삭제할까요?")) return
      const supabase = getSupabase()
      if (!supabase) return
      await supabase.from("positions").delete().eq("id", id)
      await fetchPositions({ force: true })
    },
    [fetchPositions]
  )

  const handleAdminChange = React.useCallback((field: keyof typeof adminForm, value: string) => {
    setAdminForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const parseAdminNumber = React.useCallback((value: string) => {
    if (!value) return 0
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
  }, [])

  const handleAdminSave = React.useCallback(async () => {
    setAdminError(null)
    setAdminNotice(null)
    const supabase = getSupabase()
    if (!supabase) {
      setAdminError("Supabase 설정을 확인해주세요.")
      return
    }
    setAdminLoading(true)
    try {
      const { error } = await supabase.from("positions").upsert({
        symbol: adminForm.symbol,
        direction: adminForm.side.toLowerCase(),
        leverage: parseAdminNumber(adminForm.leverage) || 1,
        amount: parseAdminNumber(adminForm.qty),
        entry_price: parseAdminNumber(adminForm.entry),
        current_price: parseAdminNumber(adminForm.mark),
        liquidation_price: parseAdminNumber(adminForm.liq),
        pnl_usd: parseAdminNumber(adminForm.pnlUsd),
        pnl_krw: parseAdminNumber(adminForm.pnlKrw),
        status: adminForm.status,
        streamer_id: "admin",
        streamer_name: adminForm.streamerName,
      })
      if (error) throw error
      setAdminNotice("포지션이 저장되었습니다.")
      await fetchPositions({ force: true })
    } catch (error: any) {
      setAdminError(error?.message || "포지션 저장 중 오류가 발생했습니다.")
    } finally {
      setAdminLoading(false)
    }
  }, [adminForm, fetchPositions, parseAdminNumber])

  React.useEffect(() => {
    fetchPositions({ force: true })
    const supabase = getSupabase()
    if (!supabase) return
    const channel = supabase
      .channel("public:positions-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "positions" }, () => {
        // 실시간 변경 발생 시 fetch (디바운스)
        if (realtimeDebounceRef.current) return
        realtimeDebounceRef.current = setTimeout(() => {
          realtimeDebounceRef.current = null
          fetchPositions()
        }, 3000)
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current)
    }
  }, [fetchPositions])

  React.useEffect(() => {
    const interval = setInterval(() => {
      fetchPositions()
    }, 20000)
    return () => clearInterval(interval)
  }, [fetchPositions])

  React.useEffect(() => {
    const interval = setInterval(() => {
      setList((prev) =>
        prev.map((p) => ({
          ...p,
          mark: p.mark,
          pnl: computePnl(p),
          spark: p.spark?.slice(-59).concat([
            (p.spark?.[p.spark?.length - 1] || p.entry) *
              (1 + (Math.random() - 0.5) * 0.002),
          ]),
        }))
      )
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const displayed = React.useMemo(() => {
    let arr = list
    if (onlyOnline) arr = arr.filter((p) => p.streamer.online)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      arr = arr.filter(
        (p) =>
          p.symbol.toLowerCase().includes(q) ||
          p.streamer.name.toLowerCase().includes(q)
      )
    }
    return arr
  }, [list, query, onlyOnline])

  const memoEntries = React.useMemo(
    () =>
      showEntries
        ? list
            .filter((p) => p.symbol === symbol)
            .map((p) => ({
              id: p.id,
              label: p.streamer.name,
              price: p.entry,
              side: p.side,
              leverage: p.leverage,
              size: p.size,
            }))
        : [],
    [showEntries, list, symbol]
  )

  const handlePrice = React.useCallback(
    (price: number) => {
      setList((prev) => {
        let changed = false
        const next = prev.map((p) => {
          if (p.symbol !== symbol) return p
          if (p.mark === price) return p
          changed = true
          return { ...p, mark: price, pnl: computePnl({ ...p, mark: price }) }
        })
        return changed ? next : prev
      })
    },
    [symbol]
  )

  return (
    <section className="space-y-4">
      {/* 상단 차트 */}
      <Card className="bg-[#141414] border-neutral-800" style={{ overflowAnchor: "none" }}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>실시간 포지션 차트</CardTitle>
              <CardDescription>{symbol} 기준 최근 변동</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="px-2 py-1.5 rounded border border-neutral-700 bg-[#1a1a1a] text-sm w-[140px]"
              >
                {availableSymbols.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showEntries}
                  onChange={(e) => setShowEntries(e.target.checked)}
                />{" "}
                진입선
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
            entries={memoEntries}
            hoveredId={hoveredId}
            onPrice={handlePrice}
          />
        </CardContent>
      </Card>

      {/* 관리자 입력 패널 */}
      {showAdminPanel ? (
        <Card className="bg-[#141414] border-neutral-800" style={{ overflowAnchor: "none" }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle>관리자 포지션 입력</CardTitle>
                <CardDescription>필요한 값을 입력해 저장하세요.</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm">
                <span className="text-muted-foreground">
                  입력값은 Supabase positions 테이블에 저장됩니다.
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {adminError ? <div className="text-sm text-red-400">{adminError}</div> : null}
            {adminNotice ? <div className="text-sm text-emerald-400">{adminNotice}</div> : null}

            {/* 1행: 진입가 / 현재가 / 청산가 */}
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs text-muted-foreground space-y-1">
                진입가
                <input
                  type="tel"
                  inputMode="decimal"
                  pattern="[0-9.,]*"
                  value={adminForm.entry || ""}
                  onChange={(e) => handleAdminChangeNumeric("entry", e.target.value)}
                  className="h-10 w-full rounded-md border border-neutral-700 bg-[#101116] px-3 text-sm text-white"
                />
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => handleAdminAppend("entry", ".")}
                    className="rounded border border-neutral-700 px-2 py-1"
                  >
                    .
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdminAppend("entry", ",")}
                    className="rounded border border-neutral-700 px-2 py-1"
                  >
                    ,
                  </button>
                </div>
              </label>

              <label className="text-xs text-muted-foreground space-y-1">
                현재가
                <input
                  type="tel"
                  inputMode="decimal"
                  pattern="[0-9.,]*"
                  value={adminForm.mark || ""}
                  onChange={(e) => handleAdminChangeNumeric("mark", e.target.value)}
                  className="h-10 w-full rounded-md border border-neutral-700 bg-[#101116] px-3 text-sm text-white"
                />
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => handleAdminAppend("mark", ".")}
                    className="rounded border border-neutral-700 px-2 py-1"
                  >
                    .
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdminAppend("mark", ",")}
                    className="rounded border border-neutral-700 px-2 py-1"
                  >
                    ,
                  </button>
                </div>
              </label>

              <label className="text-xs text-muted-foreground space-y-1">
                청산가
                <input
                  type="tel"
                  inputMode="decimal"
                  pattern="[0-9.,]*"
                  value={adminForm.liq || ""}
                  onChange={(e) => handleAdminChangeNumeric("liq", e.target.value)}
                  className="h-10 w-full rounded-md border border-neutral-700 bg-[#101116] px-3 text-sm text-white"
                />
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => handleAdminAppend("liq", ".")}
                    className="rounded border border-neutral-700 px-2 py-1"
                  >
                    .
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdminAppend("liq", ",")}
                    className="rounded border border-neutral-700 px-2 py-1"
                  >
                    ,
                  </button>
                </div>
              </label>
            </div>

            {/* 2행: P&L / 수량 */}
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs text-muted-foreground space-y-1">
                P&L (USD)
                <input
                  type="tel"
                  inputMode="decimal"
                  pattern="[0-9.,]*"
                  value={adminForm.pnlUsd || ""}
                  onChange={(e) => handleAdminChangeNumeric("pnlUsd", e.target.value)}
                  className="h-10 w-full rounded-md border border-neutral-700 bg-[#101116] px-3 text-sm text-white"
                />
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => handleAdminAppend("pnlUsd", ".")}
                    className="rounded border border-neutral-700 px-2 py-1"
                  >
                    .
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdminAppend("pnlUsd", ",")}
                    className="rounded border border-neutral-700 px-2 py-1"
                  >
                    ,
                  </button>
                </div>
              </label>

              <label className="text-xs text-muted-foreground space-y-1">
                P&L (KRW)
                <input
                  type="tel"
                  inputMode="decimal"
                  pattern="[0-9.,]*"
                  value={adminForm.pnlKrw || ""}
                  onChange={(e) => handleAdminChangeNumeric("pnlKrw", e.target.value)}
                  className="h-10 w-full rounded-md border border-neutral-700 bg-[#101116] px-3 text-sm text-white"
                />
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => handleAdminAppend("pnlKrw", ".")}
                    className="rounded border border-neutral-700 px-2 py-1"
                  >
                    .
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdminAppend("pnlKrw", ",")}
                    className="rounded border border-neutral-700 px-2 py-1"
                  >
                    ,
                  </button>
                </div>
              </label>

              <label className="text-xs text-muted-foreground space-y-1">
                수량
                <input
                  type="tel"
                  inputMode="decimal"
                  pattern="[0-9.,]*"
                  value={adminForm.qty || ""}
                  onChange={(e) => handleAdminChangeNumeric("qty", e.target.value)}
                  className="h-10 w-full rounded-md border border-neutral-700 bg-[#101116] px-3 text-sm text-white"
                />
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => handleAdminAppend("qty", ".")}
                    className="rounded border border-neutral-700 px-2 py-1"
                  >
                    .
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdminAppend("qty", ",")}
                    className="rounded border border-neutral-700 px-2 py-1"
                  >
                    ,
                  </button>
                </div>
              </label>
            </div>

            {/* 3행: 심볼 / 포지션 / 상태 */}
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs text-muted-foreground space-y-1">
                심볼
                <select
                  value={adminForm.symbol}
                  onChange={(e) => handleAdminChange("symbol", e.target.value)}
                  className="h-10 w-full rounded-md border border-neutral-700 bg-[#101116] px-3 text-sm text-white"
                >
                  {availableSymbols.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-muted-foreground space-y-1">
                포지션
                <select
                  value={adminForm.side}
                  onChange={(e) => handleAdminChange("side", e.target.value as "Long" | "Short")}
                  className="h-10 w-full rounded-md border border-neutral-700 bg-[#101116] px-3 text-sm text-white"
                >
                  <option value="Long">Long</option>
                  <option value="Short">Short</option>
                </select>
              </label>

              <label className="text-xs text-muted-foreground space-y-1">
                상태
                <select
                  value={adminForm.status}
                  onChange={(e) => handleAdminChange("status", e.target.value as "on" | "off")}
                  className="h-10 w-full rounded-md border border-neutral-700 bg-[#101116] px-3 text-sm text-white"
                >
                  <option value="on">ON</option>
                  <option value="off">OFF</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleAdminSave}
                disabled={adminLoading}
                className="rounded-md border border-transparent bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition-colors disabled:opacity-50"
              >
                {adminLoading ? "저장중.." : "저장"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setAdminForm((prev) => ({
                    ...prev,
                    entry: "",
                    mark: "",
                    liq: "",
                    pnlUsd: "",
                    pnlKrw: "",
                    qty: "",
                  }))
                }
                className="rounded-md border border-neutral-700 bg-[#101116] px-4 py-2 text-sm font-semibold text-white hover:border-white"
              >
                초기화
              </button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* 검색 / 필터 */}
      <div className="flex items-center gap-1 sm:gap-2 flex-nowrap sm:flex-wrap overflow-hidden">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="검색 (예: BTC, BJ이름)"
          className="flex-[1_1_50%] min-w-0 px-2 py-1.5 sm:px-3 sm:py-2 rounded border border-neutral-700 bg-[#1a1a1a] text-xs sm:text-sm"
        />
        <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground shrink-0 whitespace-nowrap">
          <input
            type="checkbox"
            checked={onlyOnline}
            onChange={(e) => setOnlyOnline(e.target.checked)}
          />{" "}
          ON만 보기
        </label>
        <div className="text-xs text-muted-foreground">
          {loading ? "불러오는 중..." : `${list.length}건`}
        </div>
      </div>

      {/* 포지션 카드 리스트 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3" style={{ overflowAnchor: "none" }}>
        {displayed.map((p) => {
          const KRW_RATE = 1350
          const pnlUsd = p.pnl
          const pnlKrw = (pnlUsd || 0) * KRW_RATE
          const liqGap = Math.abs((p.mark ?? 0) - (p.liq ?? 0))
          const isRisk = Number.isFinite(liqGap) && liqGap <= 200

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
            online: p.streamer.online,
            onlineFor: p.streamer.onlineFor,
            spark: p.spark,
            isRisk,
            onHover: (id) => setHoveredId(id),
            onLeave: () => setHoveredId(undefined),
            onDelete: showAdminPanel ? () => handleDelete(p.id) : undefined,
          }

          return <PositionCard key={p.id} {...cardProps} />
        })}
      </div>
    </section>
  )
}

function mapSupabaseToPosition(row: any): Position {
  return {
    id: String(row.id),
    streamer: {
      id: row.streamer_id ?? "admin",
      name: row.nickname || row.streamer_name || "관리자",
      avatar: row.profile_url || undefined,
      online: row.status === "on",
      onlineFor: row.online_for,
    },
    symbol: row.symbol,
    side: row.direction === "short" ? "Short" : "Long",
    leverage: row.leverage ? Number(row.leverage) : undefined,
    size: row.amount ? Number(row.amount) : undefined,
    entry: Number(row.entry_price) || 0,
    mark: Number(row.current_price) || Number(row.entry_price) || 0,
    liq: Number(row.liquidation_price || row.mark || row.entry_price) || 0,
    pnl: Number(row.pnl_usd) || 0,
    spark: Array.isArray(row.spark) ? row.spark : [],
  }
}

function computePnl(p: Position) {
  const side = p.side === "Long" ? 1 : -1
  return (p.mark - p.entry) * side * (p.size || 0)
}

const SparkLine = React.memo(function SparkLine({
  data,
  up,
  height = 36,
}: {
  data: number[]
  up: boolean
  height?: number
}) {
  if (!data || data.length === 0) return <div style={{ height }} className="w-full bg-neutral-800 rounded" />
  const w = 120
  const h = height
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y}`
    })
    .join(" ")
  const stroke = up ? "#34d399" : "#f87171"

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline fill="none" stroke={stroke} strokeWidth="2" points={points} />
    </svg>
  )
})

function PriceChartLW({
  symbol,
  timeframe = "1m",
  entries,
  hoveredId,
  onPrice,
}: {
  symbol: string
  timeframe?: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w" | "1M"
  entries: { id: string; label: string; price: number; side: "Long" | "Short"; leverage?: number; size?: number }[]
  hoveredId?: string
  onPrice?: (price: number) => void
}) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const chartRef = React.useRef<any>(null)
  const seriesRef = React.useRef<any>(null)
  const entriesSeriesRef = React.useRef<any>(null)
  const [data, setData] = React.useState<
    { time: number; open: number; high: number; low: number; close: number }[]
  >([])
  const [overlayLabels, setOverlayLabels] = React.useState<
    { id: string; title: string; y: number; side: "Long" | "Short" }[]
  >([])

  const updateOverlayLabels = React.useCallback(() => {
    if (!seriesRef.current) return
    const raw: { id: string; title: string; y: number; side: "Long" | "Short" }[] = []
    entries.forEach((e) => {
      const extra = e.leverage ? `x${e.leverage}` : ""
      const title = `${e.label}-${e.side}${extra ? ` (${extra})` : ""}`
      const y =
        typeof seriesRef.current.priceToCoordinate === "function"
          ? seriesRef.current.priceToCoordinate(e.price)
          : null
      if (typeof y === "number" && Number.isFinite(y)) raw.push({ id: e.id, title, y, side: e.side })
    })

    const sorted = raw.sort((a, b) => a.y - b.y)
    const adjusted: typeof raw = []
    const spacing = 16
    const containerH = ref.current?.clientHeight ?? Number.POSITIVE_INFINITY
    let lastY = -Infinity
    sorted.forEach((item) => {
      let y = Math.max(item.y, lastY + spacing)
      if (Number.isFinite(containerH)) {
        y = Math.min(y, containerH - 10)
      }
      adjusted.push({ ...item, y })
      lastY = y
    })
    setOverlayLabels(adjusted)
  }, [entries])

  // 초기 데이터 로드
  React.useEffect(() => {
    const abort = new AbortController()
    const run = async () => {
      try {
        const sym = symbol.toUpperCase()
        const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(
          sym
        )}&interval=${encodeURIComponent(timeframe)}&limit=200`
        const r = await fetch(url, { signal: abort.signal })
        if (!r.ok) return
        const j: any[] = await r.json()
        const arr = Array.isArray(j)
          ? j.map((row) => ({
              time: Math.floor(Number(row[0]) / 1000),
              open: Number(row[1]),
              high: Number(row[2]),
              low: Number(row[3]),
              close: Number(row[4]),
            }))
          : []
        if (arr.length) setData(arr)
      } catch {
        // ignore
      }
    }
    run()
    return () => abort.abort()
  }, [symbol, timeframe])

  // 실시간 WebSocket
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
          if (
            !Number.isFinite(open) ||
            !Number.isFinite(high) ||
            !Number.isFinite(low) ||
            !Number.isFinite(close) ||
            !Number.isFinite(t)
          )
            return
          if (onPrice) onPrice(close)
          const ts = Math.floor(t / 1000)
          setData((prev) => {
            if (!prev.length) return [{ time: ts, open, high, low, close }]
            const last = prev[prev.length - 1]
            if (last.time === ts) return [...prev.slice(0, -1), { time: ts, open, high, low, close }]
            return [...prev.slice(-999), { time: ts, open, high, low, close }]
          })
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
    return () => {
      try {
        ws?.close()
      } catch {
        // ignore
      }
    }
  }, [symbol, timeframe, onPrice])

  // Lightweight Charts 로드 및 차트 생성
  React.useEffect(() => {
    let destroyed = false
    const load = async () => {
      if ((window as any).LightweightCharts) return (window as any).LightweightCharts
      await new Promise<void>((resolve) => {
        const s = document.createElement("script")
        s.src =
          "https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js"
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
          layout: { background: { color: "#0f0f0f" }, textColor: "#c9d1d9" },
          grid: { vertLines: { color: "#202020" }, horzLines: { color: "#202020" } },
          rightPriceScale: { borderColor: "#2a2a2a", visible: true },
          leftPriceScale: { borderColor: "#2a2a2a", visible: false, autoScale: true },
          timeScale: {
            borderColor: "#2a2a2a",
            timeVisible: true,
            secondsVisible: false,
            tickMarkFormatter: (time: any) => {
              const t =
                typeof time === "number"
                  ? time * 1000
                  : time?.timestamp
                  ? time.timestamp * 1000
                  : Date.now()
              const d = new Date(t)
              const hh = String(d.getHours()).padStart(2, "0")
              const mm = String(d.getMinutes()).padStart(2, "0")
              return `${hh}:${mm}`
            },
          },
          crosshair: { mode: 0 },
          localization: { locale: "ko-KR" },
        })

        seriesRef.current = chartRef.current.addCandlestickSeries({
          priceScaleId: "right",
          upColor: "#22c55e",
          downColor: "#ef4444",
          borderUpColor: "#16a34a",
          borderDownColor: "#dc2626",
          wickUpColor: "#22c55e",
          wickDownColor: "#ef4444",
        })

        entriesSeriesRef.current = chartRef.current.addLineSeries({
          priceScaleId: "left",
          color: "transparent",
          lineWidth: 0,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          priceFormat: { type: "custom", formatter: () => "" },
        })
      }

      const resize = () => {
        if (!ref.current || !chartRef.current) return
        const w = Math.max(0, ref.current.clientWidth || 0)
        const isMobile = window.matchMedia("(max-width: 639.98px)").matches
        const h = isMobile ? 260 : 360
        try {
          if (typeof (chartRef.current as any).resize === "function") {
            ;(chartRef.current as any).resize(w, h)
          } else {
            ;(chartRef.current as any).applyOptions({ width: w, height: h })
          }
        } catch {
          // ignore
        }
      }

      resize()
      let ro: any
      try {
        ro = new (window as any).ResizeObserver(() => resize())
        if (ref.current) ro.observe(ref.current)
      } catch {
        // ignore
      }

      if (data && data.length && seriesRef.current) {
        seriesRef.current.setData(data)
        entriesSeriesRef.current?.setData(
          data.map((candle) => ({ time: candle.time, value: candle.close }))
        )
      }

      const cur: any = chartRef.current as any
      if (cur && cur._entryLines) {
        cur._entryLines.forEach((pl: any) => {
          if (pl?.left) entriesSeriesRef.current?.removePriceLine(pl.left)
          if (pl?.right) seriesRef.current?.removePriceLine(pl.right)
        })
        cur._entryLines = []
      }

      const lines: any[] = []
      entries.forEach((e) => {
        const extra = e.leverage ? `x${e.leverage}` : ""
        const title = `${e.label}-${e.side}${extra ? ` (${extra})` : ""}`
        const rightLine = seriesRef.current?.createPriceLine({
          price: e.price,
          color: e.side === "Long" ? "#34d399" : "#f87171",
          lineStyle: 2,
          lineWidth: hoveredId === e.id ? 3 : 1,
          axisLabelVisible: true,
          title: "",
        })
        if (rightLine) lines.push({ right: rightLine, title, side: e.side, price: e.price, id: e.id })
      })
      if (cur) cur._entryLines = lines
      updateOverlayLabels()

      return () => {
        try {
          ;(ro as any)?.disconnect?.()
        } catch {
          // ignore
        }
      }
    })
    return () => {
      destroyed = true
    }
  }, [symbol, entries, hoveredId, data, updateOverlayLabels])

  // 엔트리 라벨 위치 재계산
  React.useEffect(() => {
    if (!seriesRef.current || !data.length) return
    updateOverlayLabels()
  }, [entries, data, hoveredId, updateOverlayLabels])

  // 데이터 변경 시 차트 반영
  React.useEffect(() => {
    const LW: any = (window as any).LightweightCharts
    if (!LW || !seriesRef.current) return
    if (!data || data.length === 0) return
    seriesRef.current.setData(data)
  }, [data])

  return (
    <div className="relative h-[260px] md:h-[360px] w-full max-w-full min-w-0 overflow-hidden bg-[#0f0f0f]">
      <div ref={ref} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-0">
        {overlayLabels.map((l) => (
          <div
            key={l.id}
            className={`absolute left-1 z-10 ${
              l.side === "Long" ? "bg-[#34d399] text-black" : "bg-[#f87171] text-white"
            }`}
            style={{
              top: Math.max(0, l.y - 8),
              fontSize: "13px",
              fontWeight: 400,
              padding: "1px 4px",
              borderRadius: "2px",
              lineHeight: "1",
            }}
          >
            {l.title}
          </div>
        ))}
      </div>
    </div>
  )
}
