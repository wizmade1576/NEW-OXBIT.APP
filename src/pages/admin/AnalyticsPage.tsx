import * as React from 'react'
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
} from 'recharts'

const weeklyData = [
  { date: '06-14', visitors: 480 },
  { date: '06-15', visitors: 612 },
  { date: '06-16', visitors: 583 },
  { date: '06-17', visitors: 714 },
  { date: '06-18', visitors: 665 },
  { date: '06-19', visitors: 742 },
  { date: '06-20', visitors: 810 },
]

const topPaths = [
  { path: '/breaking', hits: 384 },
  { path: '/news', hits: 298 },
  { path: '/positions/live', hits: 176 },
  { path: '/markets/stocks', hits: 142 },
  { path: '/admin', hits: 99 },
  { path: '/positions', hits: 96 },
  { path: '/more/notices', hits: 73 },
  { path: '/positions/whales', hits: 64 },
  { path: '/news/crypto', hits: 52 },
  { path: '/more/guide', hits: 41 },
]

const deviceData = [
  { name: 'Desktop', value: 74 },
  { name: 'Mobile', value: 26 },
]

const countryData = [
  { name: 'KR', value: 44 },
  { name: 'US', value: 28 },
  { name: 'JP', value: 10 },
  { name: 'EU', value: 9 },
  { name: 'Others', value: 9 },
]

const COLORS = ['#34d399', '#60a5fa', '#f97316', '#ef4444', '#c084fc']

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
  const [realtimeVisitors, setRealtimeVisitors] = React.useState(12)
  const [isPolling, setIsPolling] = React.useState(true)

  React.useEffect(() => {
    if (!isPolling) return
    const id = setInterval(() => {
      setRealtimeVisitors((v) => Math.max(1, v + Math.floor(Math.random() * 5 - 2)))
    }, 10000)
    return () => clearInterval(id)
  }, [isPolling])

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">관리자</p>
        <h1 className="text-2xl font-semibold text-white">방문자 애널리틱스</h1>
        <p className="text-sm text-neutral-400 max-w-2xl">
          실시간 방문자 수, 트래픽 흐름, 채널 별 분포를 한눈에 볼 수 있는 대시보드입니다. 페이지별 로그 및 기기/국가 분포는 Supabase
          데이터 소스를 기반으로 업데이트됩니다.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatsCard label="오늘 방문자" value="1,248" helper="상세 정보는 daily-visits 테이블 조회" />
        <StatsCard label="실시간 방문(10분)" value={`${realtimeVisitors} 명`} helper="10초마다 폴링" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-[#0e1424] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">최근 7일 방문자</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData}>
                <XAxis dataKey="date" stroke="#4b5563" />
                <YAxis stroke="#4b5563" />
                <Tooltip contentStyle={{ backgroundColor: '#0a1120', border: 'none' }} />
                <Line type="monotone" dataKey="visitors" stroke="#38bdf8" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-[#0e1424] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">기기 비율</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={deviceData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={4}>
                  {deviceData.map((entry, idx) => (
                    <Cell key={`device-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: '#cbd5f5' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-[#0e1424] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">국가별 분포</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={countryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" stroke="#4b5563" />
                <YAxis stroke="#4b5563" />
                <Tooltip contentStyle={{ backgroundColor: '#0a1120', border: 'none' }} />
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">실시간 방문자 (10분)</p>
          <div className="mt-4 text-4xl font-semibold text-white">{realtimeVisitors}</div>
          <p className="text-xs text-muted-foreground">폴링 간격: 10초 · API 응답 지연 확인</p>
          <div className="mt-3 inline-flex gap-2">
            <button
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-white hover:border-primary"
              onClick={() => setIsPolling((prev) => !prev)}
            >
              {isPolling ? '일시중지' : '폴링 재개'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
