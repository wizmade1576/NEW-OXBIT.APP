import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import ListItemCard from '../../components/ui/ListItemCard'
import getSupabase from '../../lib/supabase/client'
import { useAuthStore } from '@/store/useAuthStore'

type DBCategory = 'economic' | 'crypto' | 'listing'
type FilterTab = 'all' | DBCategory

type ScheduleRow = {
  id: string
  title: string
  category: DBCategory
  date: string
  importance?: number | null
  country?: string | null
  coin?: string | null
  description?: string | null
  source?: string | null
}

export default function SchedulePage() {
  const [tab, setTab] = React.useState<FilterTab>('all')
  const [items, setItems] = React.useState<ScheduleRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [showSignupModal, setShowSignupModal] = React.useState(false)
  React.useEffect(() => {
    if (user) return
    const id = window.setTimeout(() => setShowSignupModal(true), 60000)
    return () => clearTimeout(id)
  }, [user])
  const [page, setPage] = React.useState(0)
  const [hasMore, setHasMore] = React.useState(true)
  const PAGE_SIZE = 30
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'economic', label: '경제지표' },
    { key: 'crypto', label: '코인 이벤트' },
    { key: 'listing', label: '상장 일정' },
  ]

  const shortTabLabel = (k: FilterTab) =>
    k === 'all' ? '전체' : k === 'economic' ? '경제' : k === 'crypto' ? '이벤트' : '상장'

  const fmt = (s: string) =>
    new Intl.DateTimeFormat('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(s))
  const catLabel = (c: DBCategory) => (c === 'economic' ? '경제지표' : c === 'crypto' ? '코인 이벤트' : '상장 일정')

  const load = React.useCallback(
    async (reset = false) => {
      const sb = getSupabase()
      if (!sb) {
        setError('Supabase env is missing')
        return
      }
      try {
        setLoading(true)
        setError(null)
        const from = reset ? 0 : page * PAGE_SIZE
        const to = from + PAGE_SIZE - 1
        let q = sb
          .from('schedules')
          .select('*')
          .order('date', { ascending: true })
          .gte('date', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
        if (tab !== 'all') q = q.eq('category', tab)
        const { data, error } = await q.range(from, to)
        if (error) throw error
        const rows = (data || []) as unknown as ScheduleRow[]
        if (reset) setItems(rows)
        else setItems((prev) => [...prev, ...rows])
        setHasMore(rows.length === PAGE_SIZE)
        if (reset) setPage(1)
        else setPage((p) => p + 1)
      } catch (e: any) {
        setError(e?.message || 'Failed to load')
      } finally {
        setLoading(false)
      }
    },
    [tab, page],
  )

  React.useEffect(() => {
    setPage(0)
    setHasMore(true)
    void load(true)
  }, [tab, load])

  React.useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !loading && hasMore) void load(false)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [loading, hasMore, load])

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

      <Card className="bg-[#121212] border-neutral-800">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-white">일정</CardTitle>
              <CardDescription>경제지표 · 코인 이벤트 · 상장 일정</CardDescription>
            </div>
            <div className="inline-flex rounded-md border border-neutral-700 overflow-hidden">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 text-sm ${tab === t.key ? 'bg-emerald-600/20 text-emerald-300' : 'bg-[#1a1a1a] hover:bg-[#1e1e1e]'}`}
                >
                  <span className="sm:hidden">{shortTabLabel(t.key)}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? <div className="text-sm text-red-400">{error}</div> : null}
          <div className="space-y-3">
            {items.length === 0 && loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start justify-between gap-4 rounded-lg border border-neutral-800 bg-[#111] p-4">
                  <div className="space-y-2 w-full">
                    <div className="h-4 w-40 bg-neutral-800 rounded" />
                    <div className="h-3 w-3/4 bg-neutral-800 rounded" />
                    <div className="h-3 w-1/2 bg-neutral-800 rounded" />
                  </div>
                  <div className="shrink-0 w-24 h-4 bg-neutral-800 rounded" />
                </div>
              ))
            ) : (
              items.map((e) => (
                <ListItemCard
                  key={e.id}
                  title={e.title}
                  description={e.description || ''}
                  metaLeft={`${fmt(e.date)} · ${catLabel(e.category)}${e.country ? ' · ' + e.country : ''}${e.coin ? ' · ' + e.coin : ''}`}
                  rightSlot={
                    <span className="inline-flex items-center gap-2 text-xs text-gray-400">
                      {typeof e.importance === 'number' ? (
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            (e.importance ?? 0) >= 3 ? 'bg-emerald-500' : (e.importance ?? 0) === 2 ? 'bg-neutral-500' : 'bg-neutral-700'
                          }`}
                        />
                      ) : null}
                      <span className="hidden sm:inline">{e.source || ''}</span>
                    </span>
                  }
                />
              ))
            )}
            <div ref={sentinelRef} />
            {loading && items.length > 0 ? <div className="text-xs text-muted-foreground text-center py-2">Loading...</div> : null}
            {!loading && items.length === 0 ? <div className="text-sm text-muted-foreground">일정이 없습니다.</div> : null}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
