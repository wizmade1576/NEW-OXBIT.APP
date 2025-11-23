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
const emptyTopPaths: { path: string; hits: number }[] = []
const emptyDeviceData: { name: string; value: number }[] = []
const emptyCountryData: { name: string; value: number }[] = []

const COLORS = ["#34d399", "#60a5fa", "#f97316", "#ef4444", "#c084fc"]
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
  const [topPaths, setTopPaths] = React.useState(emptyTopPaths)
  const [deviceData, setDeviceData] = React.useState(emptyDeviceData)
  const [countryData, setCountryData] = React.useState(emptyCountryData)
  const [realtimeVisitors, setRealtimeVisitors] = React.useState(0)
  const [todayVisitors, setTodayVisitors] = React.useState<number | null>(null)
  const [isPolling, setIsPolling] = React.useState(true)

  React.useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(ANALYTICS_ENDPOINT, {
          method: "GET",
          headers: FUNCTION_HEADERS,
        })
        if (!res.ok) throw new Error("failed")
        const contentType = res.headers.get("content-type") ?? ""
        if (!contentType.includes("application/json")) throw new Error("non-json")
        const json = await res.json()
        const source = json.source || "unknown"
        const weekly = Array.isArray(json.weeklyVisits) ? json.weeklyVisits : []
        const paths = Array.isArray(json.topPaths) ? json.topPaths : []
        const devices = Array.isArray(json.deviceShare) ? json.deviceShare : []
        const countries = Array.isArray(json.countryShare) ? json.countryShare : []

        setWeeklyData(weekly.length ? weekly : source === "supabase" ? [] : emptyWeeklyData)
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
      }
    }

    fetchAnalytics()
  }, [])

  React.useEffect(() => {
    if (!isPolling) return
    let cancelled = false

    const tick = async () => {
      try {
        const res = await fetch(ANALYTICS_ENDPOINT, { method: "GET", headers: FUNCTION_HEADERS })
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">기기 비율</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
              <PieChart>
                <Pie data={deviceData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={4}>
                  {deviceData.map((entry, idx) => (
                    <Cell key={`device-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: "#cbd5f5" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-[#0e1424] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">국가별 분포</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
              <BarChart data={countryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" stroke="#4b5563" />
                <YAxis stroke="#4b5563" />
                <Tooltip contentStyle={{ backgroundColor: "#0a1120", border: "none" }} />
                <Bar dataKey="value" fill="#818cf8" />
              </BarChart>
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
