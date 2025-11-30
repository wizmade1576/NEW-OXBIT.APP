import * as React from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import getSupabase from '../../lib/supabase/client'
import {
  fetchBreakingById,
  countLikes,
  hasLiked,
  like,
  unlike,
  fetchComments,
  addComment,
  type BreakingComment,
} from '../../lib/breaking/api'

function LikeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41 1.01 4.25 2.44C11.59 5.01 13.26 4 15 4 17.5 4 19.5 6 19.5 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

function CommentIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M20 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2v4l5.333-4H20a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
    </svg>
  )
}

function ShareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
    </svg>
  )
}

type ItemState = {
  title: string
  body: string
  time?: string
  tag?: string
  url?: string
  important?: boolean
}

export default function BreakingDetailPage() {
  // 🔥 param 이름을 key → id 로 변경 (요청된 부분)
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const state = (location.state || {}) as Partial<ItemState>

  // 🔥 state 존재하면 우선 사용, 없으면 서버 fetch (요청된 부분)
  const [item, setItem] = React.useState<ItemState | null>(state?.title ? (state as ItemState) : null)

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [text, setText] = React.useState('')
  const [liked, setLiked] = React.useState(false)
  const [likeCount, setLikeCount] = React.useState(0)
  const [comments, setComments] = React.useState<BreakingComment[]>([])

  // 🔥 URL 접근 시에도 정상적으로 admin 글 불러오기
  React.useEffect(() => {
    const load = async () => {
      if (item || !id) return

      setLoading(true)
      try {
        const r = await fetchBreakingById(id)
        if (r) {
          const d = new Date(r.publish_at || r.created_at)
          const hh = String(d.getHours()).padStart(2, '0')
          const mm = String(d.getMinutes()).padStart(2, '0')

          setItem({
            title: r.title,
            body: r.body || r.title,
            tag: r.tag || '관리자',
            url: r.source_link || undefined,
            time: `${hh}:${mm}`,
            important: !!r.is_important,
          })
        } else {
          setError('데이터를 찾을 수 없습니다')
        }
      } catch (e: any) {
        setError(e?.message || '정보를 불러오지 못했습니다')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id, item])

  // 좋아요/댓글 로딩 (admin 글만)
  React.useEffect(() => {
    const run = async () => {
      if (!id) return
      const [c, h, cmts] = await Promise.all([countLikes(id), hasLiked(id), fetchComments(id)])
      setLikeCount(c)
      setLiked(h)
      setComments(cmts)

      const supabase = getSupabase()
      if (!supabase) return

      const channel = supabase
        .channel(`breaking-detail-${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'breaking_comments', filter: `breaking_id=eq.${id}` }, (payload) => {
          setComments((arr) => [...arr, payload.new as BreakingComment])
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'breaking_likes', filter: `breaking_id=eq.${id}` }, () => {
          setLikeCount((v) => v + 1)
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'breaking_likes', filter: `breaking_id=eq.${id}` }, () => {
          setLikeCount((v) => Math.max(0, v - 1))
        })
        .subscribe()

      return () => {
        try {
          channel.unsubscribe()
        } catch {}
      }
    }

    run()
  }, [id])

  const onShare = async () => {
    if (!id || !item) return
    const url = `${window.location.origin}/breaking/${id}`

    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, url, text: item.title })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        alert('링크가 복사되었습니다.')
      }
    } catch {}
  }

  const onToggleLike = async () => {
    if (!id || !item) return
    try {
      if (liked) {
        await unlike(id)
        setLiked(false)
        setLikeCount((v) => Math.max(0, v - 1))
      } else {
        await like(id)
        setLiked(true)
        setLikeCount((v) => v + 1)
      }
    } catch (e: any) {
      alert(e?.message || '처리 중 오류가 발생했습니다.')
    }
  }

  const onSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    const v = text.trim()
    if (!v) return

    try {
      const inserted = await addComment(id, v)
      if (inserted) setComments((arr) => [...arr, inserted])
      setText('')
    } catch (e: any) {
      alert(e?.message || '댓글 등록 실패')
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">불러오는 중...</div>
  if (error) return <div className="text-sm text-red-400">{error}</div>
  if (!item) return null

  const isImportant = !!item.important

  return (
    <div className="max-w-[900px] mx-auto px-2">
      <section className="space-y-6">
        <div>
          <div className={`text-xs ${isImportant ? 'text-white' : 'text-muted-foreground'}`}>{item.time}</div>

          <h1 className={`mt-1 text-lg sm:text-xl font-semibold ${isImportant ? 'text-red-400' : 'text-foreground'}`}>
            {item.title}
          </h1>

          <div className="mt-2 flex items-center gap-3">
            {item.tag && (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                {item.tag}
              </span>
            )}

            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-blue-600/20 px-2 py-1 text-xs text-blue-400 hover:bg-blue-600/30"
              >
                원문
              </a>
            )}
          </div>

          <p className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">{item.body}</p>

          <div className="mt-6 flex items-center gap-6 text-muted-foreground">
            <button
              onClick={onToggleLike}
              className={
                'inline-flex items-center gap-2 px-2 py-1 rounded-md ' +
                (liked ? 'text-rose-400 bg-rose-500/10' : 'hover:text-foreground hover:bg-accent/60')
              }
            >
              <LikeIcon className="h-6 w-6" />
              <span className="text-sm font-medium">{likeCount}</span>
            </button>

            <a href="#comments" className="inline-flex items-center gap-2 hover:text-foreground hover:bg-accent/60 px-2 py-1 rounded-md">
              <CommentIcon className="h-6 w-6" />
            </a>

            <button
              onClick={onShare}
              className="ml-auto inline-flex items-center gap-2 hover:text-foreground hover:bg-accent/60 px-2 py-1 rounded-md"
            >
              <ShareIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* 댓글 */}
        <section id="comments" className="space-y-4">
          <h3 className="text-sm font-semibold text-white">댓글</h3>

          <div className="space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
                <div className="text-xs text-muted-foreground/80">{new Date(c.created_at).toLocaleString()}</div>
                <div className="mt-1">{c.body}</div>
              </div>
            ))}

            {comments.length === 0 ? (
              <div className="text-xs text-muted-foreground">등록된 댓글이 없습니다.</div>
            ) : null}
          </div>

          <form onSubmit={onSubmitComment} className="space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              rows={3}
              placeholder="의견을 남겨주세요."
            />
            <Button type="submit" className="px-3 py-2 text-sm">댓글 등록</Button>
          </form>
        </section>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <Link to="/breaking" className="text-blue-400 hover:underline">
            속보로 돌아가기
          </Link>
        </div>
      </section>
    </div>
  )
}
