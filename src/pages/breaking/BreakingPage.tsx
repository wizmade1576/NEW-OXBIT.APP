import * as React from 'react'
import Button from '../../components/ui/Button'
import { fetchAllTopics } from '../../lib/news/aggregate'
import { fetchBreaking, type BreakingRecord } from '../../lib/breaking/api'

type BreakingItem = {
  time: string
  title: string
  body: string
  tag?: string
}

function TimelineItem({ item }: { item: BreakingItem }) {
  const [expanded, setExpanded] = React.useState(false)
  return (
    <div className="relative grid grid-cols-[64px_1fr] gap-4">
      <div className="flex items-start justify-end">
        <span className="rounded-md bg-accent px-2 py-1 text-xs text-foreground/90">{item.time}</span>
      </div>
      <div className="pb-6">
        <h4 className="text-base font-semibold leading-6">{item.title}</h4>
        <div className={"mt-2 text-sm text-muted-foreground transition-all " + (expanded ? '' : 'max-h-12 overflow-hidden')}>{item.body}</div>
        <div className="mt-3 flex items-center gap-3">
          {item.tag && (
            <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">{item.tag}</span>
          )}
          <a href="#" className="rounded-md bg-blue-600/20 px-2 py-1 text-xs text-blue-400 hover:bg-blue-600/30">
            Quick Order
          </a>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
          >
            {expanded ? '접기' : '펼치기'}
          </button>
        </div>
        <div className="mt-4 flex items-center gap-6 text-xs text-muted-foreground">
          <span>좋아요 153</span>
          <span>댓글 8</span>
          <span>공유 2</span>
        </div>
        <div className="mt-6 h-px w-full bg-border" />
      </div>
      <div className="pointer-events-none absolute left-[32px] top-0 h-full border-l border-border" />
    </div>
  )
}

function DaySection({ label, items }: { label: string; items: BreakingItem[] }) {
  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-10 -mx-4 sm:mx-0 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-sm text-muted-foreground">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border">🗞️</span>
          <span>{label}</span>
        </div>
      </div>
      <div className="space-y-0">
        {items.map((it, idx) => (
          <TimelineItem key={idx} item={it} />
        ))}
      </div>
    </div>
  )
}

export default function BreakingPage() {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [todayItems, setTodayItems] = React.useState<BreakingItem[]>([])
  const [yesterdayItems, setYesterdayItems] = React.useState<BreakingItem[]>([])

  const load = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      // 1) Try admin-authored breaking items first
      const adminRows: BreakingRecord[] = await fetchBreaking(1, 40)
      let items: any[] = []
      if (adminRows && adminRows.length) {
        items = adminRows.map((r) => ({
          title: r.title,
          summary: r.body || r.title,
          source: r.tag || 'ADMIN',
          date: r.publish_at || r.created_at,
          url: r.source_link || undefined,
        }))
      } else {
        // 2) Fallback to public aggregator if no admin items yet
        const agg = await fetchAllTopics({ limitPerTopic: 5 })
        items = agg.items
      }
      const now = new Date()
      const diffHours = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 36e5
      const toItem = (n: any): BreakingItem => {
        const d = new Date(n.date)
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        return { time: `${hh}:${mm}`, title: n.title, body: n.summary || n.title, tag: n.source }
      }
      const today: BreakingItem[] = []
      const yesterday: BreakingItem[] = []
      for (const n of items) {
        const d = new Date(n.date)
        const dh = diffHours(now, d)
        if (dh <= 24) today.push(toItem(n))
        else if (dh <= 48) yesterday.push(toItem(n))
      }
      // Fallback: 데이터가 48시간 이전뿐이면 최신 10개를 오늘로 보여줌
      if (today.length === 0 && yesterday.length === 0) {
        today.push(...items.slice(0, 10).map(toItem))
      }
      setTodayItems(today)
      setYesterdayItems(yesterday)
    } catch (e: any) {
      setError(e?.message || '속보를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { void load() }, [])

  return (
    <section className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold">속보</h2>
          <p className="text-muted-foreground text-sm">24시간 마켓 속보</p>
        </div>
        <Button variant="outline" disabled={loading} onClick={load}>
          {loading ? '새로고침 중...' : '새로고침'}
        </Button>
      </div>
      {error ? <div className="text-sm text-red-400">{error}</div> : null}

      <DaySection label="오늘" items={todayItems} />
      <DaySection label="어제" items={yesterdayItems} />
    </section>
  )
}
