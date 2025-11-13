import * as React from 'react'
import { fetchBreaking, type BreakingRecord } from '../../lib/breaking/api'
import getSupabase from '../../lib/supabase/client'

export default function AdminBreakingPage() {
  const [items, setItems] = React.useState<BreakingRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  const [title, setTitle] = React.useState('')
  const [body, setBody] = React.useState('')
  const [tag, setTag] = React.useState('')
  const [publishAt, setPublishAt] = React.useState<string>('')
  const [pinned, setPinned] = React.useState(false)
  const [status, setStatus] = React.useState<'draft'|'published'>('published')
  const [editing, setEditing] = React.useState<BreakingRecord | null>(null)

  async function reload() {
    setLoading(true)
    const rows = await fetchBreaking(1, 50)
    setItems(rows)
    setLoading(false)
  }

  React.useEffect(() => { void reload() }, [])

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
        publish_at: publishAt ? new Date(publishAt).toISOString() : new Date().toISOString(),
      })
      if (error) { setError(error.message); return }
      await reload()
      setOpen(false)
      setTitle(''); setBody(''); setTag(''); setPublishAt(''); setPinned(false); setStatus('published')
      setNotice('저장되었습니다')
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
    setStatus((row.status as 'draft'|'published') || 'published')
    setPublishAt(row.publish_at ? row.publish_at.substring(0,16) : '')
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
      const { error } = await supabase.from('breaking_news').update({
        title: title.trim(),
        body: body.trim() || null,
        tag: tag.trim() || null,
        pinned,
        status,
        publish_at: publishAt ? new Date(publishAt).toISOString() : new Date().toISOString(),
      }).eq('id', editing.id)
      if (error) { setError(error.message); return }
      await reload()
      setOpen(false); setEditing(null)
      setTitle(''); setBody(''); setTag(''); setPublishAt(''); setPinned(false); setStatus('published')
      setNotice('수정되었습니다')
    } finally {
      setLoading(false)
    }
  }

  async function remove(row: BreakingRecord) {
    if (!confirm('삭제하시겠습니까?')) return
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
        {loading ? <div className="text-xs text-muted-foreground">로딩...</div> : null}
      </div>
      {error ? <div className="text-sm text-red-400">{error}</div> : null}
      {notice ? <div className="text-sm text-emerald-400">{notice}</div> : null}
      <div className="rounded-lg border border-border">
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
                    {r.pinned ? <span className="text-amber-300">★</span> : null}
                    <span>{r.title}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.tag || '-'}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.publish_at || r.created_at}</td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button className="rounded-md border border-border px-2 py-0.5 hover:bg-accent" onClick={()=>openEdit(r)}>수정</button>
                    <button className="rounded-md border border-border px-2 py-0.5 hover:bg-accent" onClick={()=>toggleStatus(r)}>{r.status==='published'?'비공개':'발행'}</button>
                    <button className="rounded-md border border-border px-2 py-0.5 hover:bg-accent" onClick={()=>togglePin(r)}>{r.pinned?'핀 해제':'핀 고정'}</button>
                    <button className="rounded-md border border-red-500 text-red-400 px-2 py-0.5 hover:bg-red-500/10" onClick={()=>remove(r)}>삭제</button>
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
                    <option value="draft">임시저장</option>
                  </select>
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={()=>setOpen(false)}>취소</button>
                {editing ? (
                  <button className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground" onClick={saveEdit} disabled={loading}>{loading? '수정 중...' : '수정'}</button>
                ) : (
                  <button className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground" onClick={createBreaking} disabled={loading}>{loading? '저장 중...' : '저장'}</button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
