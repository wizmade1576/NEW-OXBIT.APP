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

type Topic = 'crypto' | 'stocks' | 'fx'

const DEFAULT_THUMB = 'https://images.weserv.nl/?url=via.placeholder.com/160x90.png?text=NEWS&h=90&w=160&fit=cover&we=1'

function thumb(url?: string, w = 160, h = 90) {
  if (!url) return DEFAULT_THUMB
  try {
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${w}&h=${h}&fit=cover&we=1&il`
  } catch {
    return DEFAULT_THUMB
  }
}

function useCachedNews(params: { topic: Topic; q?: string; sort?: 'latest' | 'hot'; limit?: number }) {
  const { topic, q = '', sort = 'latest', limit = 30 } = params
  const [items, setItems] = React.useState<NewsItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const cacheKey = React.useMemo(() => `news_cache_v2_${topic}_${sort}_${q}`, [topic, sort, q])

  React.useEffect(() => {
    let mounted = true
    // paint cached snapshot immediately (fast initial paint)
    try { const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null'); if (cached?.items) { setItems(cached.items as NewsItem[]); setLoading(false) } } catch {}

    const controller = new AbortController()
    const run = async () => {
      try {
        setError(null)
        const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/news-proxy`
        const url = new URL(base)
        url.searchParams.set('topic', topic)
        url.searchParams.set('sort', sort)
        if (q) url.searchParams.set('q', q)
        url.searchParams.set('limit', String(limit))
        const r = await fetch(url.toString(), { signal: controller.signal })
        if (!r.ok) throw new Error(String(r.status))
        const j = await r.json()
        const list: NewsItem[] = Array.isArray(j?.items) ? j.items : []
        if (!mounted) return
        setItems(list)
        setLoading(false)
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), items: list })) } catch {}
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || 'fetch_error')
        setLoading(false)
      }
    }
    run()
    return () => { mounted = false; controller.abort() }
  }, [cacheKey, topic, q, sort, limit])

  return { items, loading, error }
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

export default function NewsPage() {
  const [topic, setTopic] = React.useState<Topic>('crypto')
  const [q, setQ] = React.useState('')
  const [sort, setSort] = React.useState<'latest' | 'hot'>('latest')
  const { items, loading, error } = useCachedNews({ topic, q, sort, limit: 30 })

  const list = React.useMemo(() => items, [items])

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={topic} onChange={(e)=>setTopic(e.target.value as Topic)} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm">
          <option value="crypto">암호화폐</option>
          <option value="stocks">증시</option>
          <option value="fx">환율/외환</option>
        </select>
        <select value={sort} onChange={(e)=>setSort(e.target.value as any)} className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm">
          <option value="latest">최신순</option>
          <option value="hot">인기순</option>
        </select>
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="검색(예: bitcoin)" className="px-2 py-1 rounded border border-neutral-700 bg-[#1a1a1a] text-sm flex-1 min-w-[200px]" />
      </div>

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
    </section>
  )
}

