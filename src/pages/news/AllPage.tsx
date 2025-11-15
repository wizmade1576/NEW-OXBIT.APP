import * as React from 'react'
import InfiniteListSkeleton from '../../components/skeletons/InfiniteListSkeleton'
import useInfiniteScroll from '../../hooks/useInfiniteScroll'
import { fetchAllTopics, type CursorState, type PageState } from '../../lib/news/aggregate'
import type { NewsItem } from '../../lib/news/providers'
import { normalizeNewsUrl } from '../../lib/news/providers'
import PreviewImage from '../../components/news/PreviewImage'

const LS_KEY = 'news:all:v2'
const CACHE_TTL_MS = 1000 * 60 * 10 // 10 minutes

export default function AllPage() {
  const [items, setItems] = React.useState<NewsItem[]>([])
  const [cursor, setCursor] = React.useState<CursorState>({})
  const [page, setPage] = React.useState<PageState>({ crypto: 1, stocks: 1, fx: 1 })
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [hasMore, setHasMore] = React.useState(true)
  const fetchingRef = React.useRef(false)
  const { ref } = useInfiniteScroll({ onIntersect: () => { if (!loading) void loadMore() } })

  const formatKR = (s?: string) => {
    if (!s) return ''
    const d = new Date(s)
    if (isNaN(d.getTime())) return s
    const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    const date = d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
    return `${time}  ${date}`
  }
  const hostFrom = (u?: string) => { try { return u ? new URL(u).hostname : '' } catch { return '' } }
  const domainIcon = (u?: string) => { const h = hostFrom(u); return h ? `https://icons.duckduckgo.com/ip3/${h}.ico` : '/favicon.svg' }

  // Hydrate from localStorage to avoid flashing loader when returning
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) { if (!loading) void loadMore(); return }
      const cached = JSON.parse(raw)
      if (cached && Array.isArray(cached.items)) {
        setItems(cached.items)
        setCursor(cached.cursor || {})
        setPage(cached.page || { crypto: 1, stocks: 1, fx: 1 })
        setHasMore(Boolean(cached.hasMore))
        // If cache is empty, try fetching immediately
        if (!cached.items.length && !loading) {
          void loadMore()
          return
        }
        // Background refresh only when cache is stale
        const age = Date.now() - Number(cached.ts || 0)
        if (age > CACHE_TTL_MS) {
          ;(async () => {
            if (fetchingRef.current) return
            fetchingRef.current = true
            try {
              const { items: more, cursor: nextC, page: nextP } = await fetchAllTopics({ cursor: {}, page: {}, limitPerTopic: 5 })
              if (Array.isArray(more) && more.length) {
                setItems(more)
                setCursor(nextC)
                setPage(nextP)
                setHasMore(true)
                localStorage.setItem(LS_KEY, JSON.stringify({ items: more, cursor: nextC, page: nextP, hasMore: true, ts: Date.now() }))
              }
            } catch {}
            fetchingRef.current = false
          })()
        }
      }
    } catch {}
  }, [])

  // Persist to localStorage whenever items advance
  React.useEffect(() => {
    try {
      const payload = { items, cursor, page, hasMore, ts: Date.now() }
      localStorage.setItem(LS_KEY, JSON.stringify(payload))
    } catch {}
  }, [items, cursor, page, hasMore])

  const loadMore = React.useCallback(async () => {
    if (!hasMore) return
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      setLoading(true)
      const { items: more, cursor: nextC, page: nextP } = await fetchAllTopics({ cursor, page, limitPerTopic: 5 })
      setItems(prev => {
        const seen = new Set(prev.map(it => normalizeNewsUrl(it.url) || it.id))
        const fresh = more.filter(it => {
          const key = normalizeNewsUrl(it.url) || it.id
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        const merged = [...prev, ...fresh]
        if (fresh.length === 0) setHasMore(false)
        return merged
      })
      setCursor(nextC)
      setPage(nextP)
      if (!more || more.length === 0) setHasMore(false)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
      setHasMore(false)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [cursor, page, hasMore])

  const filtered = React.useMemo(() => {
    const list = items.slice().sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime())
    return list
  }, [items])

  return (
    <section className="space-y-6">
      {error ? <div className="text-sm text-red-400">{error}</div> : null}
      {loading && items.length === 0 ? <InfiniteListSkeleton items={3} /> : null}
      <div className="rounded-lg overflow-hidden bg-[#0f1115] divide-y divide-[#1f2530]">
        {filtered.map((n) => (
          <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="block">
            <div className="p-4 md:p-5 hover:bg-[#151a24] transition-colors">
              <div className="w-full flex flex-col md:flex-row items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] md:text-xs text-[#8a93a6] mb-1">{formatKR(n.date)}</div>
                  <h4 className="text-base md:text-lg font-bold text-white leading-snug line-clamp-2 break-words">{n.title}</h4>
                  {n.summary ? <p className="mt-2 text-sm text-[#a7b0c0] line-clamp-2 break-words">{n.summary}</p> : null}
                  <div className="mt-2 text-[11px] md:text-xs text-[#8a93a6]">{n.source}</div>
                </div>
                <PreviewImage url={n.url} image={n.image} alt={n.title} className="w-full h-32 md:w-40 md:h-24 shrink-0" />
              </div>
            </div>
          </a>
        ))}
      </div>
      {!loading && filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">표시할 항목이 없습니다.</div>
      ) : null}
      {hasMore ? <div ref={ref} /> : null}
      {loading && items.length > 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground">불러오는 중…</div>
      ) : null}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          className="h-8 px-3 text-xs rounded-full border border-input hover:bg-accent"
          onClick={async () => {
            // Force refresh ignoring cache
            setHasMore(true); setCursor({}); setPage({} as any)
            if (!loading) {
              fetchingRef.current = false
              await loadMore()
            }
          }}
        >새로고침</button>
      </div>
    </section>
  )
}
