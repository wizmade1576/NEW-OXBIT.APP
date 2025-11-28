import * as React from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card"

type LongShortRow = {
  symbol: string
  longPct: number
  shortPct: number
  maxLiqPrice?: number | null
  updatedAt?: string
}

const POLL_MS = 60 * 1000 // 60초 폴링

const clampPct = (pct: number) => {
  if (!Number.isFinite(pct)) return 0
  return Math.max(0, Math.min(100, pct))
}

const toRow = (r: any): LongShortRow => {
  const longPct = Number(r?.long_pct ?? r?.longPct ?? 0)
  const shortPct = Number(r?.short_pct ?? r?.shortPct ?? 0)
  return {
    symbol: String(r?.symbol ?? "").toUpperCase(),
    longPct,
    shortPct,
    maxLiqPrice: Number(r?.max_liq_price ?? r?.maxLiqPrice ?? r?.max_liquidation_price) || null,
    updatedAt: r?.updated_at ?? r?.updatedAt,
  }
}

function Bar({ row }: { row: LongShortRow }) {
  const longPercent = Math.round(clampPct(row.longPct) * 100)
  const shortPercent = Math.round(clampPct(row.shortPct) * 100)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[13px] text-neutral-300">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{row.symbol}</span>
        </div>
        <div className="text-xs text-neutral-500 hidden sm:block">롱/숏 비율</div>
      </div>
      <div className="w-full h-6 bg-neutral-800 rounded overflow-hidden flex border border-neutral-700">
        <div
          className="flex items-center justify-center text-white font-semibold text-sm"
          style={{ width: `${longPercent}%`, backgroundColor: "#1ba45bff", transition: "width 0.4s ease" }}
          title={`Long ${longPercent}%`}
        >
           {longPercent}%
        </div>
        <div
          className="flex items-center justify-center text-white font-semibold text-sm"
          style={{ width: `${shortPercent}%`, backgroundColor: "#b93030ff", transition: "width 0.4s ease" }}
          title={`Short ${shortPercent}%`}
        >
           {shortPercent}%
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
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Binance ${symbol} 응답 오류: ${res.status}`)
        const json = await res.json()
        const payload = Array.isArray(json) ? json[0] : json
        if (!payload) return null
        let longPct = Number(payload.longAccount ?? 0)
        let shortPct = Number(payload.shortAccount ?? 0)
        const ratio = Number(payload.longShortRatio ?? 0)
        if (
          (!Number.isFinite(longPct) || !Number.isFinite(shortPct) || longPct + shortPct === 0) &&
          Number.isFinite(ratio) &&
          ratio > 0
        ) {
          longPct = (ratio / (1 + ratio)) * 100
          shortPct = 100 - longPct
        }
        const ts = Number(payload.timestamp)
        return {
          symbol: String(payload.symbol ?? symbol).toUpperCase(),
          long_pct: Number.isFinite(longPct) ? longPct : 0,
          short_pct: Number.isFinite(shortPct) ? shortPct : 0,
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
            <span className="rounded-full bg-[#1e2633] px-3 py-1 text-xs text-neutral-300">Binance</span>
            {lastUpdated ? (
              <span className="text-xs text-neutral-500">업데이트: {new Date(lastUpdated).toLocaleString()}</span>
            ) : null}
          </div>
          <CardDescription className="text-sm text-neutral-300">
            Binance 롱/숏 계정 비율을 60초마다 갱신합니다. 비율(%)만 표시합니다.
          </CardDescription>
          <div className="mt-2 text-xs text-neutral-400">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-emerald-500/90" /> 롱
            </span>
            <span className="inline-flex items-center gap-2 ml-3">
              <span className="inline-block h-3 w-3 rounded-full bg-rose-500/85" /> 숏
            </span>
            <span className="inline-block ml-3 text-[11px] text-[#fbbf24]">
              최대 청산 클러스터가 있으면 하단에 표시됩니다.
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
