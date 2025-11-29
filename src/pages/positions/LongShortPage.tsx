import * as React from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card"

type LongShortRow = {
  symbol: string
  longPct: number
  shortPct: number
  longNotionalUsd: number
  shortNotionalUsd: number
  totalNotionalUsd: number
  maxLiqPrice?: number | null
  updatedAt?: string
}

const POLL_MS = 60 * 1000 // 60초 폴링
const KRW_RATE = 1350

const clampPct = (pct: number) => {
  if (!Number.isFinite(pct)) return 0
  return Math.max(0, Math.min(100, pct))
}

const fmtKrw = (v?: number) => {
  if (!Number.isFinite(v as number)) return "--"
  const val = v as number
  if (val >= 1e12) return `${(val / 1e12).toFixed(1)}조 원`
  if (val >= 1e8) return `${Math.round(val / 1e8).toLocaleString("ko-KR")}억 원`
  return `${Math.round(val).toLocaleString("ko-KR")}원`
}

const toRow = (r: any): LongShortRow => {
  const longPct = normalizePct(Number(r?.long_pct ?? r?.longPct ?? 0))
  const shortPct = normalizePct(Number(r?.short_pct ?? r?.shortPct ?? 0))
  const longNotionalUsd = Number(r?.long_notional_usd ?? r?.longNotionalUsd ?? 0)
  const shortNotionalUsd = Number(r?.short_notional_usd ?? r?.shortNotionalUsd ?? 0)
  const totalNotionalUsd = Number(
    r?.total_notional_usd ?? r?.totalNotionalUsd ?? longNotionalUsd + shortNotionalUsd
  )
  return {
    symbol: String(r?.symbol ?? "").toUpperCase(),
    longPct,
    shortPct,
    longNotionalUsd,
    shortNotionalUsd,
    totalNotionalUsd,
    maxLiqPrice: Number(r?.max_liq_price ?? r?.maxLiqPrice ?? r?.max_liquidation_price) || null,
    updatedAt: r?.updated_at ?? r?.updatedAt,
  }
}

const normalizePct = (v: number) => {
  if (!Number.isFinite(v)) return 0
  // Binance 응답이 0~1 구간이면 %로 환산
  return v <= 1.5 ? v * 100 : v
}

function Bar({ row }: { row: LongShortRow }) {
  const longPercent = Math.round(clampPct(row.longPct))
  const shortPercent = Math.round(clampPct(row.shortPct))
  const totalPercent = longPercent + shortPercent || 100
  const longWidth = `${(longPercent / totalPercent) * 100}%`
  const shortWidth = `${(shortPercent / totalPercent) * 100}%`

  const longKrw = row.longNotionalUsd * KRW_RATE
  const shortKrw = row.shortNotionalUsd * KRW_RATE
  const totalKrw = row.totalNotionalUsd * KRW_RATE

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[13px] text-neutral-300">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{row.symbol}</span>
          <span className="text-xs text-neutral-500">{fmtKrw(totalKrw)}</span>
        </div>
        <div className="text-xs text-neutral-500 hidden sm:block">롱/숏 비율</div>
      </div>
      <div className="w-full h-10 bg-neutral-900 rounded-full overflow-hidden border border-neutral-700 flex">
        <div
          className="flex flex-col items-center justify-center text-white font-semibold text-sm"
          style={{ width: longWidth, backgroundColor: "#1eb69d", transition: "width 0.4s ease" }}
          title={`Long ${longPercent}%`}
        >
          <span>롱 {longPercent}%</span>
          <span className="text-[11px] text-[#e3fff6]">{fmtKrw(longKrw)}</span>
        </div>
        <div
          className="flex flex-col items-center justify-center text-white font-semibold text-sm ml-auto"
          style={{ width: shortWidth, backgroundColor: "#e45f6e", transition: "width 0.4s ease" }}
          title={`Short ${shortPercent}%`}
        >
          <span>숏 {shortPercent}%</span>
          <span className="text-[11px] text-[#ffe4ea]">{fmtKrw(shortKrw)}</span>
        </div>
      </div>
      {row.maxLiqPrice ? (
        <div className="text-[11px] text-amber-300/90">최대 청산 클러스터: {row.maxLiqPrice}</div>
      ) : null}
    </div>
  )
}

export default function LongShortPage() {
  const [rows, setRows] = React.useState<LongShortRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null)

  const fetchRows = React.useCallback(async () => {
    setLoading((prev) => prev || rows.length === 0)
    setError(null)
    try {
      const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT", "DOGEUSDT", "AVAXUSDT", "LTCUSDT", "ADAUSDT"]
      const requests = symbols.map(async (symbol) => {
        const url = `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${encodeURIComponent(
          symbol
        )}&period=5m&limit=1`
        const spotUrl = `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`
        const [ratioRes, tickerRes] = await Promise.all([fetch(url), fetch(spotUrl)])
        if (!ratioRes.ok) throw new Error(`Binance ${symbol} 응답 오류: ${ratioRes.status}`)
        const json = await ratioRes.json()
        const payload = Array.isArray(json) ? json[0] : json
        if (!payload) return null
        let longPct = normalizePct(Number(payload.longAccount ?? 0))
        let shortPct = normalizePct(Number(payload.shortAccount ?? 0))
        const ratio = Number(payload.longShortRatio ?? 0)
        if (
          (!Number.isFinite(longPct) || !Number.isFinite(shortPct) || longPct + shortPct === 0) &&
          Number.isFinite(ratio) &&
          ratio > 0
        ) {
          longPct = (ratio / (1 + ratio)) * 100
          shortPct = 100 - longPct
        }
        const tickerJson: any = await tickerRes.json()
        const quoteVolume = Number(tickerJson?.quoteVolume ?? 0)
        const totalUsd = Number.isFinite(quoteVolume) ? quoteVolume : 0
        const longUsd = totalUsd * (longPct / 100)
        const shortUsd = totalUsd * (shortPct / 100)
        const ts = Number(payload.timestamp)
        return {
          symbol: String(payload.symbol ?? symbol).toUpperCase(),
          long_pct: Number.isFinite(longPct) ? longPct : 0,
          short_pct: Number.isFinite(shortPct) ? shortPct : 0,
          long_notional_usd: longUsd,
          short_notional_usd: shortUsd,
          total_notional_usd: totalUsd,
          max_liq_price: null,
          updated_at: Number.isFinite(ts) ? new Date(ts).toISOString() : new Date().toISOString(),
        }
      })

      const results = await Promise.allSettled(requests)
      const mapped = results
        .map((r) => (r.status === "fulfilled" ? r.value : null))
        .filter((r): r is any => !!r)
      if (!mapped.length) throw new Error("표시할 Binance 롱/숏 데이터가 없습니다.")

      const normalized = mapped.map(toRow).filter((r) => r.symbol)
      normalized.sort((a, b) => (b.totalNotionalUsd || 0) - (a.totalNotionalUsd || 0))
      setRows(normalized)
      setLastUpdated(new Date().toISOString())
    } catch (e: any) {
      setError(e?.message || "데이터를 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }, [rows.length])

  React.useEffect(() => {
    fetchRows()
    const id = setInterval(fetchRows, POLL_MS)
    return () => clearInterval(id)
  }, [fetchRows])

  return (
    <section className="space-y-4">
      <Card className="bg-[#0f1115] border-neutral-800">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle className="text-white">롱 vs 숏 포지션 비율</CardTitle>
            <span className="rounded-full bg-[#1e2633] px-3 py-1 text-xs text-neutral-300">Binance · KRW</span>
            {lastUpdated ? (
              <span className="text-xs text-neutral-500">업데이트: {new Date(lastUpdated).toLocaleString()}</span>
            ) : null}
          </div>
          <CardDescription className="text-sm text-neutral-300">
            Binance 롱/숏 계정 비율을 60초마다 갱신합니다. 비율(%)과 추정 금액(KRW)을 표시합니다.
          </CardDescription>
          <div className="mt-2 text-xs text-neutral-400 flex items-center gap-3">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: "#1eb69d" }} />
              롱
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: "#e45f6e" }} />
              숏
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <div className="text-sm text-rose-400">{error}</div> : null}
          {loading && rows.length === 0 ? <div className="text-sm text-neutral-400">불러오는 중...</div> : null}
          {!loading && rows.length === 0 ? (
            <div className="text-sm text-neutral-400">표시할 데이터가 없습니다.</div>
          ) : null}
          {rows.map((row) => (
            <Bar key={row.symbol} row={row} />
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
