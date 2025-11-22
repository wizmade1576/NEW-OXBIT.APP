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

type ItemState = {
  key: string
  title: string
  body: string
  time?: string
  tag?: string
  url?: string
  prevKey?: string
  nextKey?: string
}

export default function BreakingDetailPage() {
  const { key } = useParams<{ key: string }>()
  const location = useLocation()
  const state = (location.state || {}) as Partial<ItemState>
  const [item, setItem] = React.useState<ItemState | null>(state.key ? (state as ItemState) : null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [text, setText] = React.useState('')
  const [liked, setLiked] = React.useState(false)
  const [likeCount, setLikeCount] = React.useState(0)
  const [comments, setComments] = React.useState<BreakingComment[]>([])

  // When URL key or navigation state changes, reinitialize item from state.
  React.useEffect(() => {
    setItem(state.key ? (state as ItemState) : null)
    setError(null)
    setText('')
  }, [key, location.state])

  React.useEffect(() => {
    const load = async () => {
      if (item || !key) return
      // Only try to fetch admin detail when key indicates admin-
      if (key.startsWith('admin-')) {
        setLoading(true)
        setError(null)
        try {
          const id = decodeURIComponent(key.replace(/^admin-/, ''))
          const r = await fetchBreakingById(id)
          if (r) {
            const d = new Date(r.publish_at || r.created_at)
            const hh = String(d.getHours()).padStart(2, '0')
            const mm = String(d.getMinutes()).padStart(2, '0')
            setItem({
              key,
              title: r.title,
              body: r.body || r.title,
              tag: r.tag || '관리자',
              url: r.source_link || undefined,
              time: `${hh}:${mm}`,
            })
          } else {
            setError('항목을 찾을 수 없습니다')
          }
        } catch (e: any) {
          setError(e?.message || '상세를 불러오지 못했습니다')
        } finally {
          setLoading(false)
        }
      } else {
        // Aggregated 항목은 state 기반으로만 표시 (직접 진입 시 제공 불가)
        setError('이 항목은 직접 링크로 열 수 없습니다')
      }
    }
    void load()
  }, [item, key])

  // Load likes and comments for admin posts; fallback to local for agg
  React.useEffect(() => {
    const run = async () => {
      if (!key || !key.startsWith('admin-')) return
      const id = decodeURIComponent(key.replace(/^admin-/, ''))
      const [c, h, cmts] = await Promise.all([
        countLikes(id),
        hasLiked(id),
        fetchComments(id),
      ])
      setLikeCount(c)
      setLiked(h)
      setComments(cmts)

      // Realtime updates
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
        try { channel.unsubscribe() } catch {}
      }
    }
    const cleanup = run()
    return () => { void cleanup }
  }, [key])

  async function makeShareImage(title: string, tag?: string): Promise<File | null> {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 630
      const ctx = canvas.getContext('2d')!
      // background
      ctx.fillStyle = '#0b1020'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      // title
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 56px system-ui, -apple-system, Segoe UI, Roboto'
      const maxWidth = canvas.width - 120
      const lines: string[] = []
      const words = title.split(' ')
      let line = ''
      for (const w of words) {
        const test = line ? line + ' ' + w : w
        if (ctx.measureText(test).width > maxWidth) {
          lines.push(line)
          line = w
        } else line = test
      }
      if (line) lines.push(line)
      lines.slice(0, 4).forEach((l, i) => {
        ctx.fillText(l, 60, 160 + i * 70)
      })
      // tag
      if (tag) {
        ctx.fillStyle = '#93c5fd'
        ctx.font = 'bold 28px system-ui'
        ctx.fillText(tag, 60, 120)
      }
      // brand
      ctx.fillStyle = '#94a3b8'
      ctx.font = '24px system-ui'
      ctx.fillText('OXBIT • Breaking', 60, canvas.height - 60)
      const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b as Blob), 'image/png'))
      return new File([blob], 'share.png', { type: 'image/png' })
    } catch { return null }
  }

  const onShare = async () => {
    if (!key || !item) return
  const encodedKey = key ? encodeURIComponent(key) : ''
  const fallbackUrl = `${window.location.origin}/breaking${encodedKey ? `/${encodedKey}` : ''}`
  const url = item.url || fallbackUrl
    try {
      if (navigator.share) {
        const file = await makeShareImage(item.title, item.tag)
        const payload: any = { title: item.title, url, text: item.title }
        if (file && (navigator as any).canShare?.({ files: [file] })) payload.files = [file]
        await navigator.share(payload)
      }
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        alert('링크가 복사되었습니다')
      }
    } catch {}
  }

  const adminId = key?.startsWith('admin-') ? decodeURIComponent(key.replace(/^admin-/, '')) : undefined

  const onToggleLike = async () => {
    if (!adminId) return alert('관리자 등록 속보에서만 지원됩니다')
    try {
      if (liked) { await unlike(adminId); setLiked(false); setLikeCount((v) => Math.max(0, v - 1)) }
      else { await like(adminId); setLiked(true); setLikeCount((v) => v + 1) }
    } catch (e: any) { alert(e?.message || '좋아요 처리 중 오류') }
  }

  const onAddComment = async () => {
    const v = text.trim()
    if (!v) return
    if (!adminId) {
      alert('관리자 등록 속보에서만 댓글 동기화가 됩니다')
      return
    }
    try {
      const inserted = await addComment(adminId, v)
      if (inserted) setComments((arr) => [...arr, inserted])
      setText('')
    } catch (e: any) {
      alert(e?.message || '댓글 등록 실패')
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">불러오는 중…</div>
  if (error) return <div className="text-sm text-red-400">{error}</div>
  if (!item) return null

  return (
    <div className="max-w-[900px] mx-auto px-2">
    <section className="space-y-6">
      <div>
        <div className="text-xs text-muted-foreground">{item.time}</div>
        <h1 className="mt-1 text-xl font-semibold">{item.title}</h1>
        <div className="mt-2 flex items-center gap-3">
          {item.tag && <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{item.tag}</span>}
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer" className="rounded-md bg-blue-600/20 px-2 py-1 text-xs text-blue-400 hover:bg-blue-600/30">원문</a>
          )}
        </div>
        <p className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">{item.body}</p>
        <div className="mt-6 flex items-center gap-6 text-muted-foreground">
          <button onClick={onToggleLike} className={'inline-flex items-center gap-2 px-2 py-1 rounded-md ' + (liked ? 'text-rose-400 bg-rose-500/10' : 'hover:text-foreground hover:bg-accent/60')}>
            <LikeIcon className="h-6 w-6" />
            <span className="text-sm font-medium">{likeCount}</span>
          </button>
          <a href="#comments" className="inline-flex items-center gap-2 hover:text-foreground hover:bg-accent/60 px-2 py-1 rounded-md">
            <CommentIcon className="h-6 w-6" />
          </a>
          <button onClick={onShare} className="ml-auto inline-flex items-center gap-2 hover:text-foreground hover:bg-accent/60 px-2 py-1 rounded-md" title="공유하기">
            <ShareIcon className="h-6 w-6" />
          </button>
        </div>
      </div>


      <div className="flex justify-center">
        <Link to="/breaking" className="text-sm text-blue-400 hover:underline">속보로 돌아가기</Link>
      </div>

      <div id="comments" className="space-y-3">
        <h2 className="text-lg font-semibold">댓글</h2>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="댓글을 입력하세요"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <Button onClick={onAddComment} size="sm">등록</Button>
        </div>
        <div className="space-y-2">
          {comments.length === 0 ? (
            <div className="text-sm text-muted-foreground">첫 댓글을 남겨보세요.</div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="rounded-md border border-border p-2 text-sm">{c.body}</div>
            ))
          )}
        </div>
      </div>
    </section>
    </div>
  )
}
