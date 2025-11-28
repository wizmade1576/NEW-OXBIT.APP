import * as React from "react"
import useInfiniteNews, { type NewsItem as InfiniteNewsItem } from "../../hooks/useInfiniteNews"

const TOPICS: Array<{ label: string; value: "all" | "crypto" | "stocks" | "fx" }> = [
  { label: "전체", value: "all" },
  { label: "암호화폐", value: "crypto" },
  { label: "해외증시", value: "stocks" },
  { label: "환율/금리", value: "fx" },
]


const formatKSTDate = (input?: string | number | null) => {
  if (input == null) return ""
  const date =
    typeof input === "number"
      ? new Date(input)
      : typeof input === "string"
      ? new Date(input)
      : null

  if (!date || Number.isNaN(date.getTime())) return String(input)

  const formatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value || ""
  return `${get("year")}.${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`
}

type NewsItem = InfiniteNewsItem & { fetchedAt?: number | string }

const NewsCard = React.memo(function NewsCard({ item }: { item: NewsItem }) {
  const hasImage = typeof item.image === "string" && item.image.trim() !== ""
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="flex w-full max-w-3xl gap-3 rounded-2xl border border-white/10 bg-[#0b111b] p-2 text-white transition hover:border-white/30 sm:p-3"
    >
      {hasImage && (
        <div className="flex-shrink-0 w-24 sm:w-32 md:w-40">
          <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-slate-800">
            <img
              src={item.image!}
              alt={item.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <div className="text-sm font-semibold leading-snug text-white line-clamp-2 sm:text-base">
          {item.title}
        </div>
        {item.summary && (
          <p className="text-[11px] leading-snug text-neutral-400 line-clamp-2 sm:text-xs">{item.summary}</p>
        )}
        <div className="mt-auto flex items-center gap-1 text-[10px] uppercase tracking-wider text-neutral-500 sm:text-xs">
          <span>{item.source}</span>
          <span>·</span>
          <time dateTime={item.date}>{formatKSTDate(item.fetchedAt)}</time>
        </div>
      </div>
    </a>
  )
})

const NewsPage = ({ initialTopic = "all" }: { initialTopic?: "all" | "crypto" | "stocks" | "fx" }) => {
  const [topic, setTopic] = React.useState<"all" | "crypto" | "stocks" | "fx">(initialTopic)
  const { items, loading, error, hasMore, fetchNext } = useInfiniteNews({
    topic,
    pageSize: 20,
  })

  const visibleItems = React.useMemo(() => items, [items])

  const sentinelRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        if (hasMore) fetchNext()
      },
      { rootMargin: "0px 0px 200px 0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, fetchNext])

  return (
    <section className="relative w-full max-w-full overflow-x-hidden bg-[#030712] pb-20 sm:mx-auto sm:max-w-3xl">
      <div className="px-4 py-5">
        <header className="space-y-3">
          <h1 className="text-2xl font-bold text-white">뉴스</h1>
          <div className="flex gap-2">
            {TOPICS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setTopic(tab.value)}
                className={`flex-1 rounded-2xl border px-2 py-1 text-xs font-semibold transition sm:px-3 sm:py-2 sm:text-sm ${
                  topic === tab.value
                    ? "border-white bg-white/10 text-white"
                    : "border-white/20 text-white/70 hover:border-white/40"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-sm text-rose-200">
            뉴스 정보를 불러오는 중 오류가 발생했습니다.
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="mt-6 text-center text-sm text-neutral-400">로딩 중...</div>
        ) : (
          <div className="mt-4 space-y-3">
        {visibleItems.map((item) => (
          <NewsCard key={item.id || item.url} item={item} />
        ))}
          </div>
        )}

        {loading && items.length > 0 && (
          <div className="mt-3 text-center text-xs text-neutral-500">더 불러오는 중...</div>
        )}

        {!hasMore && items.length > 0 && (
          <div className="mt-3 text-center text-xs text-neutral-500">기사 목록이 모두 로드되었습니다.</div>
        )}

        <div ref={sentinelRef} className="h-4" />
      </div>
    </section>
  )
}

export default NewsPage
