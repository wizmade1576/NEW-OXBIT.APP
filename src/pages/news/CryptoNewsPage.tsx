import * as React from 'react'
import InfiniteListSkeleton from '../../components/skeletons/InfiniteListSkeleton'
import useInfiniteScroll from '../../hooks/useInfiniteScroll'
import { fetchCrypto, getProvider, type NewsItem, normalizeNewsUrl } from '../../lib/news/providers'
import PreviewImage from '../../components/news/PreviewImage'

export default function CryptoNewsPage() {
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
  const [items, setItems] = React.useState<NewsItem[]>([])
  const [cursor, setCursor] = React.useState<string | undefined>(undefined)
  const [page, setPage] = React.useState<number>(1)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const { ref } = useInfiniteScroll({ onIntersect: () => { if (!loading) void loadMore() } })
  // controls removed
  const [hasMore, setHasMore] = React.useState(true)
  const fetchingRef = React.useRef(false)
  const LS_KEY = 'news:crypto:v2'
  const CACHE_TTL_MS = 1000 * 60 * 10

  // Hydrate from localStorage to prevent flashing loader on back navigation
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return
      const c = JSON.parse(raw)
      if (Array.isArray(c.items)) {
        setItems(c.items)
        setCursor(c.cursor)
        setPage(c.page || 1)
        setHasMore(Boolean(c.hasMore))
        const age = Date.now() - Number(c.ts || 0)
        if (!c.items.length && !loading) {
          void loadMore()
          return
        }
        if (age > CACHE_TTL_MS) {
          ;(async () => {
            if (fetchingRef.current) return
            fetchingRef.current = true
            try {
              const provider = getProvider()
              const { items: more, cursor: nextCursor, nextPage } = await fetchCrypto(provider === 'reddit' ? undefined : provider === 'finnhub' ? undefined : 1)
              if (Array.isArray(more) && more.length) {
                setItems(more)
                if (provider === 'finnhub' || provider === 'reddit') setCursor(nextCursor)
                else setPage(nextPage || 1)
                setHasMore(true)
                localStorage.setItem(LS_KEY, JSON.stringify({ items: more, cursor: nextCursor, page: nextPage || 1, hasMore: true, ts: Date.now() }))
              }
            } catch {}
            fetchingRef.current = false
          })()
        }
      }
    } catch {}
  }, [])

  React.useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ items, cursor, page, hasMore, ts: Date.now() })) } catch {}
  }, [items, cursor, page, hasMore])

  const loadMore = React.useCallback(async () => {
    if (!hasMore) return
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      setLoading(true)
      const provider = getProvider()
      const { items: more, cursor: nextCursor, nextPage } = await fetchCrypto(provider === 'reddit' ? cursor : provider === 'finnhub' ? cursor : page)
      setItems((prev) => {
        const seen = new Set(prev.map((it) => normalizeNewsUrl(it.url) || it.id))
        const fresh = more.filter((it) => {
          const key = normalizeNewsUrl(it.url) || it.id
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        const merged = [...prev, ...fresh]
        if (fresh.length === 0) setHasMore(false)
        return merged
      })
      if (provider === 'finnhub' || provider === 'reddit') setCursor(nextCursor)
      else if (provider === 'marketaux' || provider === 'newsapi') setPage(nextPage || page)
      if (!more || more.length === 0) setHasMore(false)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
      setHasMore(false)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [cursor, page, hasMore])

  // initial load handled in hydrate effect to avoid flashing loader

  return (
    <section className="space-y-6">
      {error ? <div className="text-sm text-red-400">{error}</div> : null}
      {loading && items.length === 0 ? <InfiniteListSkeleton items={3} /> : null}
      <div className="rounded-lg overflow-hidden bg-[#0f1115] divide-y divide-[#1f2530]">
        {items
          .slice()
          .sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime())
          .map((n) => (
          <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="block">
            <div className="p-4 md:p-5 hover:bg-[#151a24] transition-colors">
              <div className="w-full flex flex-col md:flex-row items-start gap-4 overflow-hidden">
                <div className="flex-1 min-w-0 max-w-full">
                  <div className="text-[11px] md:text-xs text-[#8a93a6] mb-1">{formatKR(n.date)}</div>
                  <h4 className="text-base md:text-lg font-bold text-white leading-snug line-clamp-2 break-all md:break-words">{n.title}</h4>
                  {n.summary ? <p className="mt-2 text-sm text-[#a7b0c0] line-clamp-2 break-all md:break-words">{n.summary}</p> : null}
                  <div className="mt-2 text-[11px] md:text-xs text-[#8a93a6]">{n.source}</div>
                </div>
                <PreviewImage url={n.url} image={n.image} alt={n.title} className="w-full h-32 md:w-40 md:h-24 shrink-0" />
              </div>
            </div>
          </a>
        ))}
      </div>
      {hasMore ? <div ref={ref} /> : null}
      {loading && items.length > 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground">불러오는 중…</div>
      ) : null}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          className="h-8 px-3 text-xs rounded-full border border-input hover:bg-accent"
          onClick={async () => {
            setHasMore(true); setCursor(undefined); setPage(1)
            if (!loading) { fetchingRef.current = false; await loadMore() }
          }}
        >새로고침</button>
      </div>
    </section>
  )
}
