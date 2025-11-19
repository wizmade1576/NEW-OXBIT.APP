import * as React from 'react'
import { fetchBreaking, type BreakingRecord } from '../../lib/breaking/api'
import getSupabase from '../../lib/supabase/client'

export default function AdminBreakingPage() {
  const [items, setItems] = React.useState<BreakingRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const pageSize = 20
  const [hasMore, setHasMore] = React.useState(true)

  const [title, setTitle] = React.useState('')
  const [body, setBody] = React.useState('')
  const [tag, setTag] = React.useState('')
  const [publishAt, setPublishAt] = React.useState<string>('')
  const [initialPublishAtInput, setInitialPublishAtInput] = React.useState<string>('')
  const [pinned, setPinned] = React.useState(false)
  const [status, setStatus] = React.useState<'draft'|'published'>('published')
  const [important, setImportant] = React.useState(false)
  const [editing, setEditing] = React.useState<BreakingRecord | null>(null)

  async function reload(p = page) {
    setLoading(true)
    const supabase = getSupabase()
    if (!supabase) { setItems([]); setHasMore(false); setLoading(false); return }
    const from = (p - 1) * pageSize
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('breaking_news')
      .select('*')
      .order('pinned', { ascending: false, nullsFirst: false })
      .order('publish_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) { setItems([]); setHasMore(false) }
    else { setItems(data || []); setHasMore(((data?.length) ?? 0) === pageSize) }
    setLoading(false)
  }

  React.useEffect(() => { void reload(1); setPage(1) }, [])

  function nowLocal(): string {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }

  async function createBreaking() {
    setError(null)
    if (!title.trim()) { setError('제목을 입력하세요'); return }
    const supabase = getSupabase()
    if (!supabase) { setError('Supabase 설정을 확인하세요'); return }
    setLoading(true)
    try {
      const { error } = await supabase.from('breaking_news').insert({
        title: title.trim(),
        body: body.trim() || null,
        tag: tag.trim() || null,
        pinned,
        status,
        is_important: important,


        publish_at: publishAt ? new Date(publishAt).toISOString() : new Date().toISOString(),
      })
      if (error) { setError(error.message); return }
      await reload()
      setOpen(false)
      ; setImportant(false)
      setNotice('등록되었습니다')
    } finally {
      setLoading(false)
    }
  }

  function openEdit(row: BreakingRecord) {
    setEditing(row)
    setTitle(row.title || '')
    setBody(row.body || '')
    setTag(row.tag || '')
    setPinned(!!row.pinned)
    setImportant(!!(row as any).is_important)
    setStatus((row.status as 'draft'|'published') || 'published')
    const inputVal = row.publish_at ? toLocalInputKST(row.publish_at) : ''
    setPublishAt(inputVal)
    setInitialPublishAtInput(inputVal)
    setOpen(true)
  }

  async function saveEdit() {
    if (!editing) return
    setError(null)
    const supabase = getSupabase()
    if (!supabase) { setError('Supabase 설정을 확인하세요'); return }
    if (!title.trim()) { setError('제목을 입력하세요'); return }
    setLoading(true)
    try {
      const payload: any = {
        title: title.trim(),
        body: body.trim() || null,
        tag: tag.trim() || null,
        pinned,
        status,
        is_important: important,
      }

      // 입력 날짜/시간을 변경했다면 값이 있을 때만 publish_at 반영
      if (publishAt !== initialPublishAtInput && publishAt) {
        payload.publish_at = new Date(publishAt).toISOString()
      }
      const { error } = await supabase.from('breaking_news').update(payload).eq('id', editing.id)
      if (error) { setError(error.message); return }
      await reload()
      setOpen(false); setEditing(null)
      ; setImportant(false)
      setNotice('수정되었습니다')
    } finally {
      setLoading(false)
    }
  }

  async function remove(row: BreakingRecord) {
    if (!confirm('정말 삭제하시겠습니까?')) return
    const supabase = getSupabase()
    if (!supabase) { setError('Supabase 설정을 확인하세요'); return }
    setLoading(true)
    try {
      const { error } = await supabase.from('breaking_news').delete().eq('id', row.id)
      if (error) { setError(error.message); return }
      await reload(); setNotice('삭제되었습니다')
    } finally { setLoading(false) }
  }

  async function togglePin(row: BreakingRecord) {
    const supabase = getSupabase(); if (!supabase) return
    setLoading(true)
    try {
      await supabase.from('breaking_news').update({ pinned: !row.pinned }).eq('id', row.id)
      await reload()
    } finally { setLoading(false) }
  }

  async function toggleStatus(row: BreakingRecord) {
    const supabase = getSupabase(); if (!supabase) return
    const next = row.status === 'published' ? 'draft' : 'published'
    setLoading(true)
    try {
      await supabase.from('breaking_news').update({ status: next }).eq('id', row.id)
      await reload()
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">속보 관리</h2>
      <div className="flex items-center gap-3">
        <button
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
          onClick={()=>{ setEditing(null); setTitle(''); setBody(''); setTag(''); setPinned(false); setStatus('published'); setPublishAt(nowLocal()); setOpen(true) }}
        >
          새로 만들기
        </button>
        {loading ? <div className="text-xs text-muted-foreground">濡쒕뵫...</div> : null}
      </div>
      {error ? <div className="text-sm text-red-400">{error}</div> : null}
      {notice ? <div className="text-sm text-emerald-400">{notice}</div> : null}
      {/* Mobile list (cards) */}
      <div className="sm:hidden space-y-3">
        {items.map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {r.pinned ? <span className="text-amber-400">📌</span> : null}
                  <h3 className={"font-medium text-sm truncate " + (r.is_important ? "text-red-500 font-semibold" : "")}>{r.title}</h3>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  <span className="mr-2">{r.tag || '-'}</span>
                  <span className="mr-2">{r.status}</span>
                  <span>{fmtKST(r.publish_at || r.created_at)}</span>
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-nowrap gap-2">
              <button className="rounded-md border border-border px-2 py-1 text-xs whitespace-nowrap" onClick={()=>openEdit(r)}>수정</button>
              <button className="rounded-md border border-border px-2 py-1 text-xs whitespace-nowrap" onClick={()=>toggleStatus(r)}>{r.status==='published'?'비공개':'발행'}</button>
              <button className="rounded-md border border-border px-2 py-1 text-xs whitespace-nowrap" onClick={()=>togglePin(r)}>{r.pinned?'핀 해제':'핀 고정'}</button>
              <button className="rounded-md border border-red-500 text-red-500 px-2 py-1 text-xs whitespace-nowrap" onClick={()=>remove(r)}>삭제</button>
            </div>
          </div>
        ))}
        {items.length === 0 && !loading ? (
          <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">표시할 항목이 없습니다.</div>
        ) : null}
      </div>
      <div className="hidden sm:block rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-accent/30 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">제목</th>
              <th className="px-3 py-2 text-left">태그</th>
              <th className="px-3 py-2 text-left">상태</th>
              <th className="px-3 py-2 text-left">발행시각</th>
              <th className="px-3 py-2 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {r.pinned ? <span className="text-amber-300">📌</span> : null}
                    <span className={r.is_important ? "text-red-500 font-semibold" : undefined}>{r.title}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.tag || '-'}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 text-muted-foreground">{fmtKST(r.publish_at || r.created_at)}</td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button className="rounded-md border border-border px-2 py-0.5 hover:bg-accent whitespace-nowrap" onClick={()=>openEdit(r)}>수정</button>
                    <button className="rounded-md border border-border px-2 py-0.5 hover:bg-accent whitespace-nowrap" onClick={()=>toggleStatus(r)}>{r.status==='published'?'비공개':'발행'}</button>
                    <button className="rounded-md border border-border px-2 py-0.5 hover:bg-accent whitespace-nowrap" onClick={()=>togglePin(r)}>{r.pinned?'핀 해제':'핀 고정'}</button>
                    <button className="rounded-md border border-red-500 text-red-400 px-2 py-0.5 hover:bg-red-500/10 whitespace-nowrap" onClick={()=>remove(r)}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading ? (
              <tr>
                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={4}>게시된 속보가 없습니다.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">페이지 {page}</div>
        <div className="inline-flex items-center gap-2">
          <button
            className="rounded-md border border-border px-2 py-1 text-sm disabled:opacity-50"
            disabled={loading || page <= 1}
            onClick={() => { const n = Math.max(1, page - 1); setPage(n); void reload(n) }}
          >
            이전
          </button>
          <button
            className="rounded-md border border-border px-2 py-1 text-sm disabled:opacity-50"
            disabled={loading || !hasMore}
            onClick={() => { const n = page + 1; setPage(n); void reload(n) }}
          >
            다음
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setOpen(false)} />
          <div className="relative z-10 w-[92%] max-w-2xl rounded-lg border border-border bg-card p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">속보 작성</h3>
              <button className="text-sm text-muted-foreground hover:underline" onClick={()=>setOpen(false)}>닫기</button>
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div>
                <label className="mb-1 block">제목</label>
                <input value={title} onChange={e=>setTitle(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2" />
              <div className="mt-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={important} onChange={e=>setImportant(e.target.checked)} />
                  중요 속보 (제목 빨간색 강조)
                </label>
              </div>
              </div>
              <div>
                <label className="mb-1 block">본문</label>
                <textarea value={body} onChange={e=>setBody(e.target.value)} rows={6} className="w-full rounded-md border border-input bg-background p-2" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block">태그</label>
                  <input value={tag} onChange={e=>setTag(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2" />
                </div>
                <div>
                  <label className="mb-1 block">발행시각</label>
                  <input type="datetime-local" value={publishAt} onChange={e=>setPublishAt(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={pinned} onChange={e=>setPinned(e.target.checked)} /> 상단 고정</label>
                  <select value={status} onChange={e=>setStatus(e.target.value as any)} className="h-9 rounded-md border border-input bg-background px-2">
                    <option value="published">발행</option>
                    <option value="draft">초안</option>
                  </select>
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={()=>setOpen(false)}>취소</button>
                {editing ? (
                  <button className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground" onClick={saveEdit} disabled={loading}>{loading? '수정 중...' : '수정'}</button>
                ) : (
                  <button className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground" onClick={createBreaking} disabled={loading}>{loading? '등록 중...' : '등록'}</button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

  // 한국 시간(KST) 날짜 포맷: YYYY-MM-DD HH:mm:ss
function fmtKST(iso?: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  try {
    const parts = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(d)
    const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
    const yyyy = get('year')
    const mm = get('month')
    const dd = get('day')
    const hh = get('hour')
    const mi = get('minute')
    const ss = get('second')
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
  } catch {
    // Intl이 동작하지 않는 환경 대비
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }
}

  // ISO 문자열을 KST 기준 datetime-local 입력(YYYY-MM-DDTHH:mm)으로 변환
function toLocalInputKST(iso: string): string {
  const d = new Date(iso)
  try {
    const parts = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d)
    const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
    const yyyy = get('year')
    const mm = get('month')
    const dd = get('day')
    const hh = get('hour')
    const mi = get('minute')
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
  } catch {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
}






