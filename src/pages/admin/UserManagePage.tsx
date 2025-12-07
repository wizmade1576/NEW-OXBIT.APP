import * as React from 'react'
import getSupabase from '../../lib/supabase/client'

type UserProfileRow = {
  id: string
  name: string | null
  nickname: string | null
  phone: string | null
  gender: string | null
  interest: string | null
  role: string | null
  created_at: string | null
  updated_at: string | null
}

export default function UserManagePage() {
  const [rows, setRows] = React.useState<UserProfileRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const resolveAdminEndpoint = () => {
    const configuredEndpoint = import.meta.env.VITE_ADMIN_USERS_ENDPOINT
    if (configuredEndpoint && !configuredEndpoint.includes('<')) return configuredEndpoint
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (!supabaseUrl) return null
    const hostname = supabaseUrl.replace(/https?:\/\//, '').split('.')[0]
    if (!hostname) return null
    return `https://${hostname}.functions.supabase.co/admin-users`
  }

  const loadUsers = React.useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Supabase client unavailable')
      const sessionResponse = await supabase.auth.getSession()
      const session = sessionResponse.data?.session
      const accessToken = session?.access_token
      if (!accessToken) throw new Error('Authentication required')

      const baseUrl = resolveAdminEndpoint()
      if (!baseUrl) throw new Error('Admin endpoint not configured')

      const res = await fetch(`${baseUrl}?limit=200`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(body || 'Failed to fetch admin users')
      }

      const payload = await res.json()
      if (!payload?.ok) throw new Error(payload?.error || 'Failed to load user profiles')
      setRows(payload.data ?? [])
    } catch (err: any) {
      console.error('Failed to load user profiles:', err)
      setLoadError(String(err.message || err))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">회원 관리</h1>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-border bg-[#0b0f15]">
        <table className="w-full min-w-[950px] text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted-foreground">
            <tr>{['순서', '이름', '닉네임', '전화번호', '성별', '관심사', '권한', '가입일'].map((label) => (
              <th key={label} className="px-4 py-3 text-left">
                {label}
              </th>
            ))}</tr>
          </thead>

          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  조회된 회원 정보가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const cells = [
                  idx + 1,
                  row.name ?? '미등록',
                  row.nickname ?? '미등록',
                  row.phone ?? '미등록',
                  row.gender ?? '미입력',
                  row.interest ?? '미입력',
                  row.role ?? 'user',
                  row.created_at ? new Date(row.created_at).toLocaleString('ko-KR') : '-',
                ]
                return (
                  <tr key={row.id} className="border-t border-border hover:bg-white/5">{cells.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-4 py-3">
                      {cell}
                    </td>
                  ))}</tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-border bg-[#0b0f15] px-4 py-3 text-sm text-red-300">
          {loadError}
        </div>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      )}
    </section>
  )
}
