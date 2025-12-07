import * as React from 'react'
import getSupabase from '../../lib/supabase/client'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'

const ADMIN_USERS_ENDPOINT = (import.meta as any).env?.VITE_ADMIN_USERS_ENDPOINT || ''

type UserProfile = {
  id: string
  email: string
  name: string | null
  nickname: string | null
  phone: string | null
  gender: string | null
  interest: string | null
  created_at: string
  profile_url?: string | null
  symbol?: string | null
  direction?: 'long' | 'short' | null
  leverage?: number | null
  amount?: number | null
  entry_price?: number | null
  current_price?: number | null
  pnl_usd?: number | null
  pnl_krw?: number | null
  status?: 'on' | 'off' | null
  chart?: string | null
}

type FormState = {
  nickname: string
  phone: string
  gender: string
  interest: string
  profile_url: string
  symbol: string
  direction: 'long' | 'short'
  leverage: string
  amount: string
  entry_price: string
  current_price: string
  pnl_usd: string
  pnl_krw: string
  status: 'on' | 'off'
  chart: string
}

const createEmptyForm = (): FormState => ({
  nickname: '',
  phone: '',
  gender: '',
  interest: '',
  profile_url: '',
  symbol: '',
  direction: 'long',
  leverage: '1',
  amount: '',
  entry_price: '',
  current_price: '',
  pnl_usd: '',
  pnl_krw: '',
  status: 'on',
  chart: '',
})

export default function UsersPage() {
  const [users, setUsers] = React.useState<UserProfile[]>([])
  const [search, setSearch] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [hasMore, setHasMore] = React.useState(true)
  const [modal, setModal] = React.useState<UserProfile | null>(null)
  const [edit, setEdit] = React.useState<UserProfile | null>(null)
  const [form, setForm] = React.useState<FormState>(createEmptyForm)
  const limit = 10

  const fetchUsers = React.useCallback(async () => {
    if (!ADMIN_USERS_ENDPOINT) return
    const supabase = getSupabase()
    if (!supabase) return
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token
      if (!accessToken) {
        setUsers([])
        setHasMore(false)
        return
      }

      const params = new URLSearchParams()
      if (searchQuery.trim()) params.append('search', searchQuery.trim())
      params.append('page', String(page))
      params.append('limit', String(limit))

      const res = await fetch(`${ADMIN_USERS_ENDPOINT}?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText)
        throw new Error(errorText || '서버 요청에 실패했습니다.')
      }

      const payload = await res.json().catch(() => null)
      const data = payload?.data ?? []
      const count = payload?.count ?? null
      setUsers((prev) => (page === 1 ? data : [...prev, ...data]))
      const total = typeof count === 'number' ? count : data.length
      setHasMore(Boolean(total && page * limit < total))
    } catch (error) {
      console.error(error)
    }
  }, [page, searchQuery])

  React.useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const openDetail = (user: UserProfile) => {
    setModal(user)
  }

  const startEdit = (user: UserProfile) => {
    setEdit(user)
    setForm({
      nickname: user.nickname || '',
      phone: user.phone || '',
      gender: user.gender || '',
      interest: user.interest || '',
      profile_url: user.profile_url || '',
      symbol: user.symbol || '',
      direction: user.direction || 'long',
      leverage: user.leverage != null ? String(user.leverage) : '1',
      amount: user.amount != null ? String(user.amount) : '',
      entry_price: user.entry_price != null ? String(user.entry_price) : '',
      current_price: user.current_price != null ? String(user.current_price) : '',
      pnl_usd: user.pnl_usd != null ? String(user.pnl_usd) : '',
      pnl_krw: user.pnl_krw != null ? String(user.pnl_krw) : '',
      status: user.status || 'on',
      chart: user.chart || '',
    })
  }

  const saveEdit = async () => {
    if (!edit) return
    const supabase = getSupabase()
    if (!supabase) return
    const toNumber = (v: string) => {
      const n = Number((v || '').replace(/,/g, ''))
      return Number.isFinite(n) ? n : null
    }
    const { error } = await supabase
      .from('user_profile')
      .update({
        nickname: form.nickname || null,
        phone: form.phone || null,
        gender: form.gender || null,
        interest: form.interest || null,
        profile_url: form.profile_url || null,
        symbol: form.symbol || null,
        direction: form.direction,
        leverage: toNumber(form.leverage),
        amount: toNumber(form.amount),
        entry_price: toNumber(form.entry_price),
        current_price: toNumber(form.current_price),
        pnl_usd: toNumber(form.pnl_usd),
        pnl_krw: toNumber(form.pnl_krw),
        status: form.status,
        chart: form.chart || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', edit.id)
    if (error) {
      console.error(error)
      return
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === edit.id
          ? {
              ...u,
              nickname: form.nickname || null,
              phone: form.phone || null,
              gender: form.gender || null,
              interest: form.interest || null,
              profile_url: form.profile_url || null,
              symbol: form.symbol || null,
              direction: form.direction,
              leverage: toNumber(form.leverage),
              amount: toNumber(form.amount),
              entry_price: toNumber(form.entry_price),
              current_price: toNumber(form.current_price),
              pnl_usd: toNumber(form.pnl_usd),
              pnl_krw: toNumber(form.pnl_krw),
              status: form.status,
              chart: form.chart || null,
            }
          : u,
      ),
    )
    setEdit(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    const supabase = getSupabase()
    if (!supabase) return
    await supabase.from('user_profile').delete().eq('id', id)
    await supabase.auth.admin.deleteUser(id)
    setUsers((prev) => prev.filter((u) => u.id !== id))
  }

  return (
    <section className="space-y-4">
      <Card className="bg-[#141414] border border-border">
        <CardHeader className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle>회원관리</CardTitle>
            <CardDescription>user_profile 테이블 조회 / 수정 / 삭제</CardDescription>
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              setPage(1)
              setSearchQuery(search.trim())
            }}
          >
            <input
              className="px-3 py-1.5 rounded border border-neutral-700 bg-[#0f0f0f] text-sm"
              placeholder="이름 / 닉네임 / 전화"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
              }}
            />
            <Button size="sm" variant="secondary" type="submit">
              검색
            </Button>
          </form>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-border bg-[#0f0f0f]">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">이름</th>
                  <th className="px-3 py-2 text-left">닉네임</th>
                  <th className="px-3 py-2 text-left">전화</th>
                  <th className="px-3 py-2 text-left">이메일</th>
                  <th className="px-3 py-2 text-left">성별</th>
                  <th className="px-3 py-2 text-left">관심</th>
                  <th className="px-3 py-2 text-left">가입</th>
                  <th className="px-3 py-2 text-right">액션</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-border hover:bg-white/5">
                    <td className="px-3 py-2">{user.name || '—'}</td>
                    <td className="px-3 py-2">{user.nickname || '—'}</td>
                    <td className="px-3 py-2">{user.phone || '—'}</td>
                    <td className="px-3 py-2">{user.email}</td>
                    <td className="px-3 py-2">{user.gender || '—'}</td>
                    <td className="px-3 py-2">{user.interest || '—'}</td>
                    <td className="px-3 py-2">{new Date(user.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button onClick={() => openDetail(user)} className="text-xs text-primary hover:underline">보기</button>
                      <button onClick={() => startEdit(user)} className="text-xs text-amber-400 hover:underline">수정</button>
                      <button onClick={() => handleDelete(user.id)} className="text-xs text-red-400 hover:underline">삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <Button size="sm" variant="outline" onClick={() => setPage((prev) => Math.max(prev - 1, 1))} disabled={page === 1}>
              이전
            </Button>
            <div>페이지 {page}</div>
            <Button size="sm" variant="outline" onClick={() => setPage((prev) => prev + 1)} disabled={!hasMore}>
              다음
            </Button>
          </div>
        </CardContent>
      </Card>

      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-[#0b0f15] p-6 space-y-4">
            <h3 className="text-lg font-semibold">회원 상세</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(modal).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <div className="text-[11px] uppercase text-muted-foreground">{key}</div>
                  <div>{value ?? '—'}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setModal(null)}>닫기</Button>
            </div>
          </div>
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-[#111827] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-6">회원 정보 수정</h3>
            <div className="space-y-6">
              {/* 사용자 정보 */}
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span className="flex-1 border-b border-border" />
                  <span>사용자 정보</span>
                  <span className="flex-1 border-b border-border" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>닉네임</span>
                    <input
                      value={form.nickname}
                      onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))}
                      className="w-full rounded-md border border-border bg-[#0f0f15] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>프로필 URL</span>
                    <input
                      value={form.profile_url}
                      onChange={(e) => setForm((prev) => ({ ...prev, profile_url: e.target.value }))}
                      className="w-full rounded-md border border-border bg-[#0f0f15] px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              </section>

              {/* 포지션 정보 */}
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span className="flex-1 border-b border-border" />
                  <span>포지션 정보</span>
                  <span className="flex-1 border-b border-border" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-xs text-muted-foreground col-span-2 sm:col-span-1">
                    <span>심볼</span>
                    <input
                      value={form.symbol}
                      onChange={(e) => setForm((prev) => ({ ...prev, symbol: e.target.value }))}
                      className="w-full rounded-md border border-border bg-[#0f0f15] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>방향</span>
                    <select
                      value={form.direction}
                      onChange={(e) => setForm((prev) => ({ ...prev, direction: e.target.value as 'long' | 'short' }))}
                      className="w-full rounded-md border border-border bg-[#0f0f15] px-3 py-2 text-sm"
                    >
                      <option value="long">Long</option>
                      <option value="short">Short</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>레버리지</span>
                    <input
                      type="number"
                      value={form.leverage}
                      onChange={(e) => setForm((prev) => ({ ...prev, leverage: e.target.value }))}
                      className="w-full rounded-md border border-border bg-[#0f0f15] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>수량</span>
                    <input
                      type="number"
                      value={form.amount}
                      onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                      className="w-full rounded-md border border-border bg-[#0f0f15] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>진입가</span>
                    <input
                      type="number"
                      value={form.entry_price}
                      onChange={(e) => setForm((prev) => ({ ...prev, entry_price: e.target.value }))}
                      className="w-full rounded-md border border-border bg-[#0f0f15] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>현재가</span>
                    <input
                      type="number"
                      value={form.current_price}
                      onChange={(e) => setForm((prev) => ({ ...prev, current_price: e.target.value }))}
                      className="w-full rounded-md border border-border bg-[#0f0f15] px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              </section>

              {/* 손익 정보 */}
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span className="flex-1 border-b border-border" />
                  <span>손익 정보</span>
                  <span className="flex-1 border-b border-border" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>P&L (USD)</span>
                    <input
                      type="number"
                      value={form.pnl_usd}
                      onChange={(e) => setForm((prev) => ({ ...prev, pnl_usd: e.target.value }))}
                      className="w-full rounded-md border border-border bg-[#0f0f15] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>P&L (KRW)</span>
                    <input
                      type="number"
                      value={form.pnl_krw}
                      onChange={(e) => setForm((prev) => ({ ...prev, pnl_krw: e.target.value }))}
                      className="w-full rounded-md border border-border bg-[#0f0f15] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>상태</span>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as 'on' | 'off' }))}
                      className="w-full rounded-md border border-border bg-[#0f0f15] px-3 py-2 text-sm"
                    >
                      <option value="on">ON</option>
                      <option value="off">OFF</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>차트 JSON</span>
                    <textarea
                      value={form.chart}
                      onChange={(e) => setForm((prev) => ({ ...prev, chart: e.target.value }))}
                      className="w-full rounded-md border border-border bg-[#0f0f15] px-3 py-2 text-sm"
                      rows={3}
                    />
                  </label>
                </div>
              </section>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" size="sm" onClick={() => setEdit(null)}>취소</Button>
              <Button size="sm" onClick={saveEdit}>저장</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
