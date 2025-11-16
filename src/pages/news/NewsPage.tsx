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

const DEFAULT_THUMB = "https://via.placeholder.com/160x90.png?text=NEWS"

/* ---------------------------------------------------------
   이미지 정규화 (프록시 제거 → 원본 주소로 직접 표시)
--------------------------------------------------------- */
function normalizeImage(u?: string) {
  const v = (u || "").trim()
  if (!v) return undefined
  if (v.startsWith("http")) return v
  if (v.startsWith("//")) return `https:${v}`
  return undefined
}

/* ---------------------------------------------------------
   로컬 캐시 key
--------------------------------------------------------- */
function cacheKey(topic: Topic) {
  return `news-cache-${topic}`
}

function loadCache(topic: Topic): NewsItem[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(topic))
    if (!raw) return null
    const j = JSON.parse(raw)
    if (!Array.isArray(j.items)) return null
    return j.items
  } catch {
    return null
  }
}

function saveCache(topic: Topic, items: NewsItem[]) {
  try {
    localStorage.setItem(
      cacheKey(topic),
      JSON.stringify({
        ts: Date.now(),
        items
      })
    )
  } catch {}
}

/* ---------------------------------------------------------
   News 카드 UI
--------------------------------------------------------- */
const NewsCard = React.memo(function NewsCard({ n }: { n: NewsItem }) {
  const initial = normalizeImage(n.image)
  const [src, setSrc] = React.useState(initial)

  return (
    <a
      href={n.url}
      target="_blank"
      rel="noreferrer"
      className="group flex gap-3 rounded-xl border border-white/5 bg-[#111] p-3 shadow-sm hover:bg-[#151515] transition-all duration-150"
    >
      {src && (
        <div className="rounded-lg overflow-hidden flex-shrink-0">
          <img
            src={src}
            onError={() => setSrc(DEFAULT_THUMB)}
            alt={n.title}
            loading="lazy"
            className="h-[92px] w-[140px] sm:h-[110px] sm:w-[160px] object-cover rounded-lg"
          />
        </div>
      )}

      <div className="min-w-0 flex-1 flex flex-col">
        <div className="text-[15px] font-medium text-white leading-snug line-clamp-2 group-hover:underline">
          {n.title}
        </div>

        {n.summary && (
          <div className="mt-1 text-xs text-neutral-400 leading-snug line-clamp-2">
            {n.summary}
          </div>
        )}

        <div className="mt-auto pt-2 text-[11px] text-neutral-500 flex items-center gap-1">
          <span>{n.source}</span>
          <span>·</span>
          <time dateTime={n.date}>{new Date(n.date).toLocaleString()}</time>
        </div>
      </div>
    </a>
  )
})

/* ---------------------------------------------------------
   Skeleton
--------------------------------------------------------- */
function SkeletonCard() {
  return (
    <div className="flex gap-3 rounded-xl border border-white/5 bg-[#111] p-3 animate-pulse">
      <div className="h-[92px] w-[140px] bg-neutral-800 rounded-lg" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-4 bg-neutral-800 rounded w-5/6" />
        <div className="h-4 bg-neutral-800 rounded w-4/6" />
        <div className="h-3 bg-neutral-800 rounded w-1/3" />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------
   메인 NewsPage (즉시 렌더링 + 백그라운드 API 요청)
--------------------------------------------------------- */
export default function NewsPage({ topic = "crypto" as Topic }: { topic?: Topic }) {
  const isMix = topic === "mix"

  /* 로컬 캐시 즉시 로드 → skeleton 없이 바로 렌더 */
  const [initialCache, setInitialCache] = React.useState<NewsItem[] | null>(null)

  React.useEffect(() => {
    const cached = loadCache(topic)
    if (cached) setInitialCache(cached)
  }, [topic])

  /* 일반 뉴스 훅 */
  const {
    items,
    loading,
    error,
    fetchNext,
    hasMore
  } = useInfiniteNews({
    topic: (isMix ? "crypto" : topic) as BaseTopic,
    pageSize: 10
  })

  /* mix 뉴스 수동 상태 */
  const [mixItems, setMixItems] = React.useState<NewsItem[]>([])
  const [mixLoading, setMixLoading] = React.useState(false)
  const [mixError, setMixError] = React.useState<string | null>(null)
  const [mixPage, setMixPage] = React.useState(1)
  const [mixHasMore, setMixHasMore] = React.useState(true)
  const mixBusy = React.useRef(false)

  const sentinelRef = React.useRef<HTMLDivElement | null>(null)

  const list = initialCache ?? (isMix ? mixItems : items)

  /* ---------------------------------------------------------
     mix fetch
  --------------------------------------------------------- */
  const fetchMix = React.useCallback(async () => {
    if (!isMix || mixBusy.current || !mixHasMore) return

    mixBusy.current = true
    setMixLoading(true)

    try {
      const base = import.meta.env.VITE_SUPABASE_URL
      const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (base) {
        const url = new URL(`${base}/functions/v1/news-proxy`)
        url.searchParams.set("topic", "all")
        url.searchParams.set("limit", "20")
        url.searchParams.set("page", String(mixPage))

        const headers: Record<string, string> = {}
        if (anon) {
          headers["apikey"] = anon
          headers["Authorization"] = `Bearer ${anon}`
        }

        const r = await fetch(url.toString(), { headers })

        if (r.ok) {
          const j = await r.json()
          const arr: NewsItem[] = Array.isArray(j?.items) ? j.items : []

          setMixItems(prev => (mixPage === 1 ? arr : prev.concat(arr)))

          saveCache("mix", mixPage === 1 ? arr : mixItems.concat(arr))

          const next = j?.nextPage ?? null
          setMixPage(p => (next ? next : p + 1))
          setMixHasMore(Boolean(next && arr.length))

          setMixLoading(false)
          mixBusy.current = false
          return
        }
      }

      if (mixPage === 1) {
        const { items } = await fetchAllTopics({ limitPerTopic: 10 })
        const merged = items.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        setMixItems(merged as any)
        saveCache("mix", merged as any)
      }

      setMixHasMore(false)
    } catch (e: any) {
      setMixError(e.message)
      setMixHasMore(false)
    } finally {
      setMixLoading(false)
      mixBusy.current = false
    }
  }, [isMix, mixPage, mixHasMore, mixItems])

  /* ---------------------------------------------------------
     일반 fetch — 캐시와 상관없이 백그라운드에서 조용히 실행
  --------------------------------------------------------- */
  React.useEffect(() => {
    if (!isMix) fetchNext()
  }, [topic, isMix])

  /* mix 초기 fetch */
  React.useEffect(() => {
    if (!isMix) return
    setMixItems([])
    setMixPage(1)
    setMixHasMore(true)
    fetchMix()
  }, [isMix])

  /* ---------------------------------------------------------
     Infinite Scroll
  --------------------------------------------------------- */
  React.useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const io = new IntersectionObserver(
      entries => {
        if (!entries.some(e => e.isIntersecting)) return

        if (isMix) {
          if (!mixLoading && mixHasMore && !mixBusy.current) fetchMix()
        } else {
          if (!loading && hasMore) fetchNext()
        }
      },
      { rootMargin: "0px 0px 200px 0px" }
    )

    io.observe(el)
    return () => io.disconnect()
  }, [isMix, loading, mixLoading, hasMore, mixHasMore, fetchMix])

  /* ---------------------------------------------------------
     렌더링
  --------------------------------------------------------- */
  return (
    <section className="space-y-4">
      {!isMix && error && <div className="text-xs text-amber-300">{error}</div>}
      {isMix && mixError && <div className="text-xs text-amber-300">{mixError}</div>}

      <div className="grid grid-cols-1 gap-3">
        {initialCache
          ? initialCache.map(n => <NewsCard key={n.id || n.url} n={n} />)
          : list.length === 0
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          : list.map(n => <NewsCard key={n.id || n.url} n={n} />)}
      </div>

      <div ref={sentinelRef} />

      {!isMix && !loading && hasMore && (
        <div className="flex justify-center">
          <button
            onClick={fetchNext}
            className="px-3 py-1 rounded border border-neutral-700 bg-[#1a1a1a]"
          >
            더 보기
          </button>
        </div>
      )}

      {isMix && !mixLoading && mixHasMore && (
        <div className="flex justify-center">
          <button
            onClick={fetchMix}
            className="px-3 py-1 rounded border border-neutral-700 bg-[#1a1a1a]"
          >
            더 보기
          </button>
        </div>
      )}
    </section>
  )
}
