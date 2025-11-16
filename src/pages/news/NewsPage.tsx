import * as React from "react"
import fetchAllTopics from "../../lib/news/aggregate"
import useInfiniteNews, { type Topic as BaseTopic } from "../../hooks/useInfiniteNews"

type NewsItem = {
  id: string
  title: string
  summary?: string
  url: string
  image?: string
  date: string
  source: string
}

type Topic = BaseTopic | "mix"

const DEFAULT_THUMB =
  "https://images.weserv.nl/?url=via.placeholder.com/160x90.png?text=NEWS&h=90&w=160&fit=cover&we=1"

function normalizeImageUrl(u?: string) {
  const v = (u || "").trim()
  if (!v) return undefined
  if (v.startsWith("//")) return `https:${v}`
  if (/^https?:\/\//i.test(v)) return v
  return undefined
}

function thumb(url?: string, w = 160, h = 90) {
  if (!url) return DEFAULT_THUMB
  try {
    const abs = normalizeImageUrl(url)
    if (!abs) return DEFAULT_THUMB
    return `https://images.weserv.nl/?url=${encodeURIComponent(abs)}&w=${w}&h=${h}&fit=cover&we=1&il`
  } catch {
    return DEFAULT_THUMB
  }
}

// remove local hook; replaced by shared hooks/useInfiniteNews

const NewsCard = React.memo(function NewsCard({ n }: { n: NewsItem }) {
  const [src, setSrc] = React.useState(() => thumb(n.image))
  return (
    <a
      href={n.url}
      target="_blank"
      rel="noreferrer"
      className="group flex gap-3 rounded-md border border-neutral-800 bg-[#121212] p-3 hover:bg-[#161616] transition-colors"
    >
      <img
        src={src}
        onError={() => setSrc(DEFAULT_THUMB)}
        alt={n.title}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        referrerPolicy="no-referrer"
        width={160}
        height={90}
        className="h-[90px] w-[160px] rounded object-cover bg-neutral-900 flex-shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium line-clamp-2 group-hover:underline">{n.title}</div>
        {n.summary ? (
          <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{n.summary}</div>
        ) : null}
        <div className="mt-2 text-[11px] text-neutral-400 flex items-center gap-2">
          <span>{n.source}</span>
          <span>??/span>
          <time dateTime={n.date}>{new Date(n.date).toLocaleString()}</time>
        </div>
      </div>
    </a>
  )
})

function SkeletonCard() {
  return (
    <div className="flex gap-3 rounded-md border border-neutral-800 bg-[#121212] p-3 animate-pulse">
      <div className="h-[90px] w-[160px] bg-neutral-800 rounded" />
      <div className="flex-1 min-w-0">
        <div className="h-4 bg-neutral-800 rounded w-3/4" />
        <div className="h-4 bg-neutral-800 rounded w-2/3 mt-2" />
        <div className="h-3 bg-neutral-800 rounded w-1/3 mt-3" />
      </div>
    </div>
  )
}

export default function NewsPage({ topic = "crypto" as Topic }: { topic?: Topic }) {
  const isMix = topic === "mix"

  const { items, loading, error, fetchNext: fetchPage, hasMore, setItems, setLoading } =
    useInfiniteNews({ topic: (isMix ? 'crypto' : topic) as BaseTopic, pageSize: 20 })
  // Mix (topic=all) pagination state
  const [mixItems, setMixItems] = React.useState<NewsItem[]>([])
  const [mixLoading, setMixLoading] = React.useState(false)
  const [mixError, setMixError] = React.useState<string | null>(null)
  const [mixPage, setMixPage] = React.useState(1)
  const [mixHasMore, setMixHasMore] = React.useState(true)
  const mixBusy = React.useRef(false)

  const list = React.useMemo(() => (isMix ? mixItems : items), [isMix, mixItems, items])
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)

  // Mix: Edge Function pagination (topic=all)
  const fetchMix = React.useCallback(async () => {
    if (!isMix || mixBusy.current || !mixHasMore) return
    mixBusy.current = true
    setMixLoading(true)
    try {
      const useEdge = (import.meta as any).env?.VITE_USE_EDGE_FUNCTIONS === 'true'
      const base = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined
      const anon = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined
      if (useEdge && base) {
        const url = new URL(`${base}/functions/v1/news-proxy`)
        url.searchParams.set('topic', 'all')
        url.searchParams.set('limit', '20')
        url.searchParams.set('page', String(mixPage))
        const headers: Record<string, string> = {}
        if (anon) { headers['apikey'] = anon; headers['Authorization'] = `Bearer ${anon}` }
        const r = await fetch(url.toString(), { headers })
        if (r.ok) {
          const j = await r.json()
          const arr: NewsItem[] = Array.isArray(j?.items) ? j.items : []
          setMixItems(prev => (mixPage === 1 ? arr : prev.concat(arr)))
          const next: number | null = j?.nextPage ?? null
          setMixPage(p => (next ? next : p + 1))
          setMixHasMore(Boolean(next && arr.length))
          setMixLoading(false)
          mixBusy.current = false
          return
        }
      }
      // fallback to client aggregator (first page only)
      if (mixPage === 1) {
        const { items } = await fetchAllTopics({ limitPerTopic: 10 })
        const merged = items.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setMixItems(merged as any)
      }
      setMixHasMore(false)
    } catch (e: any) {
      setMixError(e?.message || 'fetch_error')
      setMixHasMore(false)
    } finally {
      setMixLoading(false)
      mixBusy.current = false
    }
  }, [isMix, mixPage, mixHasMore])

  React.useEffect(() => {
    if (!isMix) return
    setMixItems([])
    setMixPage(1)
    setMixHasMore(true)
    setMixError(null)
    fetchMix()
  }, [isMix, fetchMix])

  // Infinite scroll (disabled for mix)
  React.useEffect(() => {
    if (isMix) return
    fetchPage()
  }, [topic, fetchPage, isMix])

  React.useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver((ents) => {
      if (ents.some((e) => e.isIntersecting)) {
        if (isMix) fetchMix(); else fetchPage()
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [fetchPage, fetchMix, isMix])

  return (
    <section className="space-y-4">
      {!isMix && error && <div className="text-xs text-amber-300">로딩 오류: {error}</div>}
      {isMix && mixError && <div className="text-xs text-amber-300">로딩 오류: {mixError}</div>}

      <div className="grid grid-cols-1 gap-3">
        {(isMix ? mixLoading : loading) && list.length === 0
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={`sk-${i}`} />)
          : list.map((n) => <NewsCard key={n.id || n.url} n={n} />)}
      </div>

      {!isMix && !loading && list.length === 0 && (
        <div className="text-xs text-muted-foreground">표시할 뉴스가 없습니다.</div>
      )}

      {isMix && !mixLoading && list.length === 0 && (
        <div className="text-xs text-muted-foreground">표시할 뉴스가 없습니다.</div>
      )}

      {!isMix && (
        <>
          <div ref={sentinelRef} />
          {!isMix && !loading && hasMore && (
            <div className="flex justify-center">
              <button
                onClick={fetchPage}
                className="px-3 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm"
              >
                더 보기
              </button>
            </div>
          )}
          {isMix && !mixLoading && mixHasMore && (
            <div className="flex justify-center">
              <button
                onClick={fetchMix}
                className="px-3 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm"
              >
                더 보기
              </button>
            </div>
          )}
          )}
        </>
      )}
    </section>
  )
}

