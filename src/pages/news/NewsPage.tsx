import * as React from 'react'

type NewsItem = {
  id: string
  title: string
  summary?: string
  url: string
  image?: string
  date: string
  source: string
}

type Topic = 'crypto' | 'stocks' | 'fx' | 'all'

const DEFAULT_THUMB = 'https://images.weserv.nl/?url=via.placeholder.com/160x90.png?text=NEWS&h=90&w=160&fit=cover&we=1'

function thumb(url?: string, w = 160, h = 90) {
  if (!url) return DEFAULT_THUMB
  try {
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${w}&h=${h}&fit=cover&we=1&il`
  } catch {
    return DEFAULT_THUMB
  }
}

function useInfiniteNews(params: { topic: Topic; q?: string; sort?: 'latest' | 'hot'; pageSize?: number }) {
  const { topic, q = '', sort = 'latest', pageSize = 20 } = params
  const [items, setItems] = React.useState<NewsItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [cursor, setCursor] = React.useState<string | undefined>(undefined)
  const [hasMore, setHasMore] = React.useState(true)
  const cacheKey = React.useMemo(() => `news_cache_v3_${topic}_${sort}_${q}`, [topic, sort, q])
  const busyRef = React.useRef(false)

  // initial fast paint from session cache
  React.useEffect(() => {
    try { const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null'); if (cached?.items) setItems(cached.items as NewsItem[]) } catch {}
  }, [cacheKey])

  // reset when query changes
  React.useEffect(() => { setItems([]); setPage(1); setCursor(undefined); setHasMore(true) }, [topic, q, sort])

  const fetchPage = React.useCallback(async () => {
    if (busyRef.current || !hasMore) return
    busyRef.current = true
    setLoading(true)
    try {
      const baseEnv = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined
      if (!baseEnv) throw new Error('Missing VITE_SUPABASE_URL')
      const url = new URL(`${baseEnv}/functions/v1/news-proxy`)
      url.searchParams.set('topic', topic)
      url.searchParams.set('sort', sort)
      url.searchParams.set('limit', String(pageSize))
      if (q) url.searchParams.set('q', q)
      if (cursor) url.searchParams.set('cursor', cursor)
      else url.searchParams.set('page', String(page))

      const r = await fetch(url.toString())
      if (!r.ok) throw new Error(String(r.status))
      const j = await r.json()
      const list: NewsItem[] = Array.isArray(j?.items) ? j.items : []
      const nextPage = j?.nextPage as number | undefined
      const nextCursor = j?.cursor as string | undefined
      setItems(prev => (page === 1 ? list : prev.concat(list)))
      setPage(p => (nextPage ? nextPage : p + 1))
      setCursor(nextCursor)
      setHasMore(Boolean((nextPage && list.length) || nextCursor))
      try { if (page === 1) sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), items: list })) } catch {}
    } catch (e: any) {
      setError(e?.message || 'fetch_error')
      setHasMore(false)
    } finally {
      setLoading(false)
      busyRef.current = false
    }
  }, [topic, q, sort, pageSize, page, cursor, hasMore, cacheKey])

  return { items, loading, error, fetchPage, hasMore }
}

const NewsCard = React.memo(function NewsCard({ n }: { n: NewsItem }) {
  const [src, setSrc] = React.useState(() => thumb(n.image))
  return (
    <a href={n.url} target="_blank" rel="noreferrer" className="group flex gap-3 rounded-md border border-neutral-800 bg-[#121212] p-3 hover:bg-[#161616] transition-colors">
      <img
        src={src}
        onError={() => setSrc(DEFAULT_THUMB)}
        alt={n.title}
        loading="lazy"
        decoding="async"
        fetchpriority="low"
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
          <span>•</span>
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

export default function NewsPage({ topic = 'crypto' as Topic }: { topic?: Topic }) {
  const [q, setQ] = React.useState('')
  const [sort, setSort] = React.useState<'latest' | 'hot'>('latest')
  const { items, loading, error, fetchPage, hasMore } = useInfiniteNews({ topic, q, sort, pageSize: 20 })

  const list = React.useMemo(() => items, [items])
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    // initial load
    fetchPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, q, sort])

  React.useEffect(() => {
    const el = sentinelRef.current; if (!el) return
    const io = new IntersectionObserver((ents) => {
      if (ents.some(e => e.isIntersecting)) fetchPage()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [fetchPage])

  return (
    <section className="space-y-4">
      {error && (
        <div className="text-xs text-amber-300">로딩 오류: {error} (캐시/네트워크 확인)</div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {loading && list.length === 0 ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={`sk-${i}`} />)
        ) : (
          list.map((n) => <NewsCard key={n.id || n.url} n={n} />)
        )}
      </div>
      {!loading && list.length === 0 ? (
        <div className="text-xs text-muted-foreground">표시할 뉴스가 없습니다.</div>
      ) : null}
      <div ref={sentinelRef} />
      {!loading && hasMore && (
        <div className="flex justify-center">
          <button onClick={fetchPage} className="px-3 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm">더 보기</button>
        </div>
      )}
    </section>
  )
}
