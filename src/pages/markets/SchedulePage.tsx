import * as React from 'react'
import getSupabase from '../../lib/supabase/client'

type TabOption = '전체' | '경제지표' | '코인이벤트' | '상장일정'

type EventRow = {
  id: string
  title: string
  coin: string | null
  symbol: string | null
  event_date: string | null
  category: string | null
  ui_category: TabOption | null
  description: string | null
  source: string | null
}

const tabs: TabOption[] = ['전체', '경제지표', '코인이벤트', '상장일정']

const badgeColors: Record<TabOption, string> = {
  전체: 'bg-slate-600',
  경제지표: 'bg-sky-500',
  코인이벤트: 'bg-orange-500',
  상장일정: 'bg-emerald-500',
}

const categoryAccent: Record<TabOption, string> = {
  전체: 'border-neutral-800',
  경제지표: 'border-sky-500/40',
  코인이벤트: 'border-orange-500/40',
  상장일정: 'border-emerald-500/40',
}

const formatKstDate = (value: string | null | undefined) => {
  if (!value) return '날짜 미정'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '날짜 미정'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul',
  }).format(parsed)
}

const skeletonCards = Array.from({ length: 4 }, (_, index) => index)

export default function SchedulePage() {
  const [activeTab, setActiveTab] = React.useState<TabOption>('전체')
  const [events, setEvents] = React.useState<EventRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let isMounted = true

    const loadEvents = async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = getSupabase()
        let query = supabase
          .from('crypto_events')
          .select('id,title,coin,symbol,event_date,category,ui_category,description,source')
          .order('event_date', { ascending: false })

        if (activeTab !== '전체') {
          query = query.eq('ui_category', activeTab)
        }

        const { data, error } = await query
        if (error) throw error
        if (!isMounted) return

        setEvents((data ?? []) as EventRow[])
      } catch (fetchError) {
        if (!isMounted) return
        const message =
          fetchError instanceof Error ? fetchError.message : '일정을 불러오는 중 오류가 발생했습니다.'
        setError(message)
      } finally {
        if (!isMounted) return
        setLoading(false)
      }
    }

    void loadEvents()

    return () => {
      isMounted = false
    }
  }, [activeTab])

  return (
    <section className="min-h-screen bg-[#030711] px-3 py-6 text-slate-100 sm:px-4 sm:py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">

        {/* ✅ 상단 설명 박스 완전 삭제됨 */}

        {/* ✅ 카테고리 탭 - 모바일 가로 스크롤 */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const isActive = tab === activeTab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:text-sm sm:px-4 ${
                  isActive
                    ? 'border-white/70 bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.15)]'
                    : 'border-neutral-700 bg-neutral-900/60 text-slate-400 hover:text-white hover:border-white/30'
                }`}
              >
                {tab}
              </button>
            )
          })}
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/60 bg-[rgba(255,0,64,0.08)] p-3 text-xs text-red-300 sm:p-4 sm:text-sm">
            {error}
          </div>
        ) : null}

        <div className="space-y-3">
          {loading && events.length === 0
            ? skeletonCards.map((idx) => (
                <div
                  key={idx}
                  className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-[#070b18] p-3"
                >
                  <div className="h-4 w-1/3 rounded-full bg-neutral-900" />
                  <div className="space-y-2">
                    <div className="h-3 w-full rounded bg-neutral-900" />
                    <div className="h-3 w-3/4 rounded bg-neutral-900" />
                  </div>
                </div>
              ))
            : null}

          {!loading && events.length === 0 && !error ? (
            <div className="rounded-xl border border-dashed border-neutral-700 bg-[#05050f] p-4 text-center text-xs text-slate-400 sm:text-sm">
              현재 공개된 일정이 없습니다.
            </div>
          ) : null}

          {events.map((event) => {
            const uiCategory = (event.ui_category || '전체') as TabOption
            const accentBorder = categoryAccent[uiCategory]
            const badgeColor = badgeColors[uiCategory]
            const coinSymbol = [event.coin, event.symbol].filter(Boolean).join(' · ') || '코인 정보 없음'
            const sourceAvailable = Boolean(event.source?.trim())

            return (
              <article
                key={event.id}
                className={`flex flex-col gap-3 rounded-xl border ${accentBorder} bg-[#070817] p-3 transition hover:border-white/40 sm:p-5`}
              >
                {/* ✅ 모바일: 한 줄 요약 헤더 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h2 className="text-sm font-semibold text-white sm:text-lg line-clamp-2">{event.title}</h2>
                    <p className="text-[11px] text-slate-400 sm:text-sm">{coinSymbol}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white sm:px-3 sm:py-1 sm:text-xs ${badgeColor}`}>
                    {uiCategory}
                  </span>
                </div>

                {/* ✅ 날짜 + 카테고리 */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 sm:text-sm">
                  <span className="font-medium text-slate-200">
                    {formatKstDate(event.event_date)} KST
                  </span>
                  {event.category ? (
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-300 sm:px-3 sm:py-1 sm:text-xs">
                      {event.category}
                    </span>
                  ) : null}
                </div>

                {/* ✅ 모바일에서는 설명 숨김 */}
                <p className="hidden sm:block whitespace-pre-line text-sm leading-relaxed text-slate-300">
                  {event.description || '설명 정보가 없습니다.'}
                </p>

                {/* ✅ 모바일 아이콘 SOURCE 버튼 */}
                <div className="flex justify-end">
                  {sourceAvailable ? (
                    <a
                      href={event.source ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/60 bg-[#10142a] text-xs text-white hover:border-white/60 sm:h-auto sm:w-auto sm:px-4 sm:py-2"
                    >
                      ↗
                      <span className="hidden sm:inline">SOURCE</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="rounded-full border border-slate-800 px-3 py-1 text-[10px] text-slate-500 sm:px-4 sm:py-2 sm:text-xs"
                    >
                      Source 없음
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
