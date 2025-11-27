import * as React from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts"

const emptyWeeklyData: { date: string; visitors: number }[] = []
const emptyDailyUnique: { date: string; uniqueVisitors: number }[] = []
const emptyTopPaths: { path: string; hits: number }[] = []
const emptyDeviceData: { name: string; value: number }[] = []
const emptyCountryData: { name: string; value: number }[] = []

const COLORS = ["#34d399", "#60a5fa", "#f97316", "#ef4444", "#c084fc"]
const formatDate = (d: Date) => d.toISOString().slice(0, 10)
const todayStr = formatDate(new Date())
// 기본 조회 범위: 오늘만
const defaultFrom = todayStr
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ""
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ""
const ANALYTICS_SECRET = import.meta.env.VITE_ANALYTICS_INGEST_SECRET || ""
const FUNCTIONS_BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : ""
const ANALYTICS_ENDPOINT = FUNCTIONS_BASE ? `${FUNCTIONS_BASE}/analytics-report` : "/api/admin/analytics"
const FUNCTION_HEADERS =
  SUPABASE_ANON_KEY || ANALYTICS_SECRET
    ? {
        ...(SUPABASE_ANON_KEY
          ? { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
          : {}),
        ...(ANALYTICS_SECRET ? { "x-analytics-secret": ANALYTICS_SECRET } : {}),
      }
    : undefined

function StatsCard({ label, value, helper }: { label: string; value: string | number; helper?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-[#0a1021] p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  )
}

export default function AnalyticsPage() {
  const [weeklyData, setWeeklyData] = React.useState(emptyWeeklyData)
  const [dailyUnique, setDailyUnique] = React.useState(emptyDailyUnique)
  const [topPaths, setTopPaths] = React.useState(emptyTopPaths)
  const [deviceData, setDeviceData] = React.useState(emptyDeviceData)
  const [countryData, setCountryData] = React.useState(emptyCountryData)
  const [realtimeVisitors, setRealtimeVisitors] = React.useState(0)
  const [todayVisitors, setTodayVisitors] = React.useState<number | null>(null)
  const [isPolling, setIsPolling] = React.useState(true)
  const [fromDate, setFromDate] = React.useState(defaultFrom)
  const [toDate, setToDate] = React.useState(todayStr)
  const [loadingRange, setLoadingRange] = React.useState(false)

  const buildUrl = React.useCallback(
    (from: string, to: string) => {
      const url = new URL(ANALYTICS_ENDPOINT, window.location.origin)
      if (from) url.searchParams.set("from", from)
      if (to) url.searchParams.set("to", to)
      return url.toString()
    },
    []
  )

  const fetchAnalytics = React.useCallback(
    async (from: string, to: string) => {
      setLoadingRange(true)
      try {
        const res = await fetch(buildUrl(from, to), {
          method: "GET",
          headers: FUNCTION_HEADERS,
        })
        if (!res.ok) throw new Error("failed")
        const contentType = res.headers.get("content-type") ?? ""
        if (!contentType.includes("application/json")) throw new Error("non-json")
        const json = await res.json()
        const source = json.source || "unknown"
        const weekly = Array.isArray(json.weeklyVisits) ? json.weeklyVisits : []
        const uniques = Array.isArray(json.dailyUniqueVisitors) ? json.dailyUniqueVisitors : []
        const paths = Array.isArray(json.topPaths) ? json.topPaths : []
        const devices = Array.isArray(json.deviceShare) ? json.deviceShare : []
        const countries = Array.isArray(json.countryShare) ? json.countryShare : []

        setWeeklyData(weekly.length ? weekly : source === "supabase" ? [] : emptyWeeklyData)
        setDailyUnique(uniques.length ? uniques : source === "supabase" ? [] : emptyDailyUnique)
        setTopPaths(paths.length ? paths : source === "supabase" ? [] : emptyTopPaths)
        setDeviceData(devices.length ? devices : source === "supabase" ? [] : emptyDeviceData)
        setCountryData(countries.length ? countries : source === "supabase" ? [] : emptyCountryData)
        if (typeof json.realtimeVisitors === "number") {
          setRealtimeVisitors(Math.max(0, json.realtimeVisitors))
        }
        if (typeof json.todayVisitors === "number") {
          setTodayVisitors(Math.max(0, json.todayVisitors))
        }
      } catch (err) {
        console.warn("[analytics-page] fallback to defaults", err)
      } finally {
        setLoadingRange(false)
      }
    },
    [buildUrl]
  )

  React.useEffect(() => {
    fetchAnalytics(fromDate, toDate)
  }, []) // initial load

  React.useEffect(() => {
    if (!isPolling) return
    let cancelled = false

    const tick = async () => {
      try {
        const res = await fetch(buildUrl(fromDate, toDate), { method: "GET", headers: FUNCTION_HEADERS })
        if (!res.ok) throw new Error("failed")
        const contentType = res.headers.get("content-type") ?? ""
        if (!contentType.includes("application/json")) throw new Error("non-json")
        const json = await res.json()
        if (cancelled) return
        if (typeof json.realtimeVisitors === "number") setRealtimeVisitors(Math.max(0, json.realtimeVisitors))
        if (typeof json.todayVisitors === "number") setTodayVisitors(Math.max(0, json.todayVisitors))
      } catch (err) {
        console.warn("[analytics-page] realtime poll fallback", err)
      }
    }

    tick()
    const id = setInterval(tick, 10000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [isPolling, ANALYTICS_ENDPOINT])

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">관리자</p>
        <h1 className="text-2xl font-semibold text-white">방문자 애널리틱스</h1>
        <p className="text-sm text-neutral-400 max-w-2xl">
          최근 방문 추이와 채널/기기/국가 분포를 한눈에 확인하는 관리자 보드입니다. Supabase 또는 GA 보고 API를 연동하면
          실제 데이터가 채워집니다.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-[#0a1021] p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-xs uppercase tracking-[0.2em] text-neutral-400">기간</span>
          <input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => {
              const v = e.target.value || fromDate
              setFromDate(v)
              if (v > toDate) setToDate(v)
            }}
            className="rounded border border-border bg-[#0f0f15] px-3 py-1.5 text-sm text-white"
          />
          <span className="text-xs text-muted-foreground">~</span>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            max={todayStr}
            onChange={(e) => {
              const v = e.target.value || toDate
              setToDate(v)
              if (v < fromDate) setFromDate(v)
            }}
            className="rounded border border-border bg-[#0f0f15] px-3 py-1.5 text-sm text-white"
          />
        </div>
        <button
          type="button"
          onClick={() => fetchAnalytics(fromDate, toDate)}
          className="rounded-md border border-border bg-primary/80 px-4 py-2 text-sm font-semibold text-white hover:bg-primary disabled:opacity-60"
          disabled={loadingRange}
        >
          {loadingRange ? "불러오는 중..." : "적용"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatsCard label="오늘 방문" value={todayVisitors ?? "0"} helper="집계: page_events (오늘)" />
        <StatsCard label="실시간 방문(10초)" value={`${realtimeVisitors} 명`} helper="10초마다 폴링/폴백" />
      </div>

            <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-[#0e1424] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">최근 7일 방문 추이</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
              <LineChart data={weeklyData}>
                <XAxis dataKey="date" stroke="#4b5563" />
                <YAxis stroke="#4b5563" />
                <Tooltip contentStyle={{ backgroundColor: "#0a1120", border: "none" }} />
                <Line type="monotone" dataKey="visitors" stroke="#38bdf8" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-[#0e1424] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">하루 유니크 방문자(IP)</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
              <LineChart data={dailyUnique}>
                <XAxis dataKey="date" stroke="#4b5563" />
                <YAxis stroke="#4b5563" />
                <Tooltip contentStyle={{ backgroundColor: "#0a1120", border: "none" }} />
                <Line type="monotone" dataKey="uniqueVisitors" stroke="#34d399" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-[#0e1424] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">기기 비율</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
              <PieChart>
                <Pie
                  data={deviceData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={4}
                  label={({ cx, cy, midAngle, outerRadius, name, value }) => {
                    const RAD = Math.PI / 180
                    const radius = outerRadius + 18 // push label slightly outward
                    const x = cx + radius * Math.cos(-midAngle * RAD)
                    const y = cy + radius * Math.sin(-midAngle * RAD) + 8 // nudge downward for readability
                    return (
                      <text
                        x={x}
                        y={y}
                        fill="#e5e7eb"
                        textAnchor={x > cx ? "start" : "end"}
                        dominantBaseline="middle"
                        fontSize={12}
                      >
                        {`${name}: ${value}`}
                      </text>
                    )
                  }}
                  labelLine={false}
                >
                  {deviceData.map((entry, idx) => (
                    <Cell key={`device-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => value.toLocaleString()}
                  contentStyle={{ backgroundColor: "#0a1120", border: "none" }}
                />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: "#cbd5f5" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-border bg-[#0e1424] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">페이지별 방문 순위</p>
            <span className="text-xs text-muted-foreground">Top 10</span>
          </div>
          <div className="mt-3 space-y-2 text-sm text-neutral-400">
            {topPaths.map((row, index) => (
              <div key={row.path} className="flex items-center justify-between rounded-xl bg-[#111826] px-3 py-2 text-xs text-neutral-200">
                <span className="uppercase tracking-tight text-emerald-300">{index + 1}</span>
                <span className="flex-1 truncate px-3 text-left">{row.path}</span>
                <span className="text-right font-semibold text-white">{row.hits}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-[#0e1424] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">실시간 방문자(10초)</p>
          <div className="mt-4 text-4xl font-semibold text-white">{realtimeVisitors}</div>
          <p className="text-xs text-muted-foreground">폴링 간격: 10초 · API 연동 시 실제 활성 세션 표시</p>
          <div className="mt-3 inline-flex gap-2">
            <button
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-white hover:border-primary"
              onClick={() => setIsPolling((prev) => !prev)}
            >
              {isPolling ? "일시중지" : "폴링 재개"}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
