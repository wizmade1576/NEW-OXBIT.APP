import * as React from 'react'
import { Link, useLocation } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { fetchAllTopics } from '../../lib/news/aggregate'
import { fetchBreaking, type BreakingRecord, countLikes, hasLiked, like, unlike, countComments } from '../../lib/breaking/api'

type BreakingItem = {
  key: string
  time: string
  title: string
  body: string
  tag?: string
  url?: string
  id?: string
  important?: boolean
}

function LikeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41 1.01 4.25 2.44C11.59 5.01 13.26 4 15 4 17.5 4 19.5 6 19.5 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  )
}

function CommentIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M20 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2v4l5.333-4H20a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>
    </svg>
  )
}

function ShareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
    </svg>
  )
}

/* -------------------------------------------------------
    TIMELINE ITEM (紐⑤컮???꾩쟾 理쒖쟻??踰꾩쟾)
------------------------------------------------------- */
function TimelineItem({ item, prevKey, nextKey }: { item: BreakingItem; prevKey?: string; nextKey?: string }) {
  const [expanded, setExpanded] = React.useState(false)
  const [liked, setLiked] = React.useState<boolean>(() => {
    try { return localStorage.getItem(`breaking:liked:${item.key}`) === '1' } catch { return false }
  })
  const [likeCount, setLikeCount] = React.useState<number>(() => {
    try { const v = localStorage.getItem(`breaking:likes:${item.key}`); return v ? Number(v) : 0 } catch { return 0 }
  })
  const [commentCount, setCommentCount] = React.useState<number>(() => {
    try { const v = localStorage.getItem(`breaking:comments:${item.key}`); const arr = v ? JSON.parse(v) : []; return Array.isArray(arr) ? arr.length : 0 } catch { return 0 }
  })

  // Sync from admin DB
  React.useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!item.id) return
      const [c, h, cc] = await Promise.all([
        countLikes(item.id),
        hasLiked(item.id),
        countComments(item.id),
      ])
      if (!mounted) return
      setLikeCount(c)
      setLiked(h)
      setCommentCount(cc)
    }
    void load()
    return () => { mounted = false }
  }, [item.id])

  const share = async () => {
    const encoded = item.key ? encodeURIComponent(item.key) : ''
    const fallback = `${window.location.origin}/breaking${encoded ? `/${encoded}` : ''}`
    const url = item.url || fallback
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, url })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        alert('링크가 복사되었습니다')
      }
    } catch {}
  }

  const toggleLike = async () => {
    if (item.id) {
      try {
        if (liked) {
          await unlike(item.id)
          setLiked(false)
          setLikeCount((v) => Math.max(0, v - 1))
        } else {
          await like(item.id)
          setLiked(true)
          setLikeCount((v) => v + 1)
        }
      } catch (e: any) {
        alert(e?.message || '醫뗭븘??泥섎━ 以??ㅻ쪟')
      }
    } else {
      const next = !liked
      setLiked(next)
      const nextCount = likeCount + (next ? 1 : -1)
      setLikeCount(nextCount)
      try {
        localStorage.setItem(`breaking:liked:${item.key}`, next ? '1' : '0')
        localStorage.setItem(`breaking:likes:${item.key}`, String(Math.max(0, nextCount)))
      } catch {}
    }
  }

  return (
    <div className="relative grid grid-cols-[48px_1fr] sm:grid-cols-[64px_1fr] gap-2 sm:gap-4 px-1 sm:px-0 whitespace-normal break-words">
      
      {/* ?쒓컙 */}
      <div className="flex items-start justify-end pr-1 relative z-10">
        <span className="relative z-10 rounded-md bg-accent px-1.5 py-0.5 text-[10px] sm:text-xs text-foreground/90">
          {item.time}
        </span>
      </div>

      {/* ?댁슜 */}
      <div className="pb-4 sm:pb-6">
        <Link
          to={`/breaking/${item.key}`}
          state={{ ...item, prevKey, nextKey }}
          onClick={() => sessionStorage.setItem('breaking:scrollY', String(window.scrollY))}
          className="block"
        >
          <h4 className={"text-[13px] sm:text-base font-semibold leading-snug whitespace-normal break-words hover:underline " + (item.important ? "text-red-500 font-semibold" : "") }>
            {item.title}
          </h4>

          <div className={
            expanded
              ? "mt-1.5 text-xs sm:text-sm text-muted-foreground whitespace-normal break-words leading-5 sm:leading-6"
              : "mt-1.5 text-xs sm:text-sm text-muted-foreground whitespace-normal break-words leading-5 sm:leading-6 line-clamp-2"
          }>
            {item.body}
          </div>
        </Link>

        {/* Action Bar */}
        <div className="mt-2 sm:mt-3 flex items-center gap-1 sm:gap-2 flex-wrap text-[11px] sm:text-sm">

          {item.tag && (
            <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] sm:text-xs text-muted-foreground">
              {item.tag}
            </span>
          )}

          {/* ?볤? */}
          <Link
            to={`/breaking/${item.key}`}
            state={{ ...item, prevKey, nextKey }}
            onClick={() => sessionStorage.setItem('breaking:scrollY', String(window.scrollY))}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-accent/60 text-muted-foreground hover:text-foreground"
          >
            <CommentIcon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
            <span>{item.id && commentCount ? commentCount : 0}</span>
          </Link>

          {/* 醫뗭븘??*/}
          <button
            type="button"
            onClick={toggleLike}
            className={
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ' +
              (liked
                ? 'text-rose-400 bg-rose-500/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/60')
            }
          >
            <LikeIcon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
            <span>{likeCount}</span>
          </button>

          {/* 怨듭쑀 */}
          <button
            type="button"
            onClick={share}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60"
            title="怨듭쑀?섍린"
          >
            <ShareIcon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
          </button>

          {/* ?먮Ц */}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-blue-600/20 px-2 py-0.5 text-[10px] sm:text-xs text-blue-400 hover:bg-blue-600/30"
            >
              ?먮Ц
            </a>
          )}

          {/* ?붾낫湲?*/}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto rounded-md border border-border px-1.5 py-0.5 text-[11px] sm:text-xs h-[26px] hover:bg-accent"
          >
            {expanded ? '접기' : '자세히'}
          </button>
        </div>

        <div className="mt-4 sm:mt-6 h-px w-full bg-border" />
      </div>

      {/* ?몃줈 ?쇱씤 */}
      <div className="pointer-events-none absolute left-[20px] sm:left-[32px] top-0 h-full border-l border-border z-0" />
    </div>
  )
}

/* -------------------------------------------------------
    MAIN BREAKING PAGE
------------------------------------------------------- */
export default function BreakingPage() {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [items, setItems] = React.useState<BreakingItem[]>([])
  const [nowText, setNowText] = React.useState('')
  const [page, setPage] = React.useState(1)
  const pageSize = 20
  const [hasMore, setHasMore] = React.useState(true)
  const location = useLocation()
  React.useEffect(() => {
    if (!location.pathname.startsWith('/breaking/')) return
    const key = location.pathname.replace(/^\/breaking\//, '')
    const params = new URLSearchParams(location.search)
    params.set('key', key)
    window.history.replaceState(null, '', `/breaking?${params.toString()}`)
  }, [location.pathname, location.search])

  const load = React.useCallback(async (nextPage = 1, append = false) => {
    try {
      setLoading(true)
      setError(null)

      const adminRows: BreakingRecord[] = await fetchBreaking(nextPage, pageSize)

      let merged: any[] = []
      if (adminRows && adminRows.length) {
        merged = adminRows.map((r) => ({
          id: r.id,
          title: r.title,
          summary: r.body || r.title,
          source: r.tag || '愿由ъ옄',
          date: r.publish_at || r.created_at,
          url: r.source_link || undefined,
          is_important: (r as any).is_important,
          pinned: !!r.pinned,
        }))
      } else {
        // 愿由ъ옄 ?곗씠?곌? ?놁쓣 ?뚯쓽 Fallback (珥덇린 1?뚮쭔)
        if (!append && nextPage === 1) {
          const agg = await fetchAllTopics({ limitPerTopic: 5 })
          merged = agg.items
        } else {
          merged = []
        }
      }

      // ?ㅼ쓬 ?섏씠吏 媛???щ? 異붿젙: pageSize 梨꾩썙吏硫????덉쓣 媛?μ꽦
      setHasMore((adminRows?.length ?? 0) === pageSize)

      // ?뺣젹怨?蹂??
      merged.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      })

      const toItem = (n: any): BreakingItem => {
        const d = new Date(n.date)
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')

        const makeHash = (s: string) => {
          let h = 2166136261 >>> 0
          for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i)
            h = Math.imul(h, 16777619) >>> 0
          }
          return h.toString(16)
        }

        const key = n.id
          ? `admin-${String(n.id)}`
          : `agg-${makeHash(String(n.id || n.url || n.title))}`

        return {
          key,
          time: `${hh}:${mm}`,
          title: n.title,
          body: n.summary || n.title,
          tag: n.source,
          url: n.url,
          id: n.id,
          important: !!(n as any).is_important,
          pinned: !!n.pinned,
        }
      }

      const nextItems = merged.map(toItem)
      setItems((prev) => (append ? [...prev, ...nextItems] : nextItems))
      if (!append) setPage(1)
    } catch (e: any) {
      setError(e?.message || '속보를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRefresh = () => void load()

  React.useEffect(() => { void load() }, [load])

  // scroll restore
  React.useEffect(() => {
    const y = sessionStorage.getItem('breaking:scrollY')
    if (y) {
      const n = Number(y)
      if (!Number.isNaN(n)) window.scrollTo(0, n)
      sessionStorage.removeItem('breaking:scrollY')
    }
  }, [])

  // now time
  React.useEffect(() => {
    const tick = () => {
      const d = new Date()
      setNowText(
        `${String(d.getHours()).padStart(2, '0')}시 ${String(d.getMinutes()).padStart(2, '0')}분 ${String(d.getSeconds()).padStart(2, '0')}초`
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const isEmpty = !loading && !error && items.length === 0

  return (
    <div className="max-w-[900px] mx-auto px-1 sm:px-0">
      <section className="space-y-6 sm:space-y-8">

        {/* HEADER */}
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold">속보</h2>
            <p className="text-muted-foreground text-xs sm:text-sm">
              오늘의 주요 속보 : {nowText}
            </p>
          </div>

          <Button
  variant="outline"
  disabled={loading}
  onClick={handleRefresh}
  className="!text-[10px] !px-2 !py-0.5 !h-[26px] sm:!text-sm sm:!px-3 sm:!py-1"
>
  {loading ? '새로고침 중…' : '새로고침'}
</Button>

        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}
        {isEmpty && <div className="text-sm text-muted-foreground">표시할 항목이 없습니다.</div>}

        {/* LIST */}
        <div className="space-y-0">
          {items.map((it, idx) => (
            <TimelineItem
              key={it.key}
              item={it}
              prevKey={idx > 0 ? items[idx - 1]?.key : undefined}
              nextKey={idx < items.length - 1 ? items[idx + 1]?.key : undefined}
            />
          ))}
        </div>

        {/* ?붾낫湲?*/}
        {hasMore && (
          <div className="mt-2 flex justify-center">
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => {
                const next = page + 1
                setPage(next)
                void load(next, true)
              }}
              className="!text-sm !px-4 !py-1.5"
            >
              {loading ? '불러오는 중…' : '더보기'}
            </Button>
          </div>
        )}

      </section>
    </div>
  )
}
