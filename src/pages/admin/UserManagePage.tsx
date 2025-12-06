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

  const loadUsers = React.useCallback(async () => {
    setLoading(true)
    try {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('user_profile')
        .select('id, name, nickname, phone, gender, interest, role, created_at, updated_at')
        .order('created_at', { ascending: false })

      if (error) throw error
      setRows(data ?? [])
    } catch (err) {
      console.error('Failed to load user profiles:', err)
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
            <tr>
              <th className="px-4 py-3 text-left">순서</th>   {/* 🔥 순서 추가 */}
              <th className="px-4 py-3 text-left">이름</th>
              <th className="px-4 py-3 text-left">닉네임</th>
              <th className="px-4 py-3 text-left">전화번호</th>
              <th className="px-4 py-3 text-left">성별</th>
              <th className="px-4 py-3 text-left">관심사</th>
              <th className="px-4 py-3 text-left">권한</th>
              <th className="px-4 py-3 text-left">가입일</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  조회된 회원 정보가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={row.id} className="border-t border-border hover:bg-white/5">
                  <td className="px-4 py-3">{idx + 1}</td> {/* 🔥 순번 출력 */}
                  <td className="px-4 py-3">{row.name ?? '미등록'}</td>
                  <td className="px-4 py-3">{row.nickname ?? '미등록'}</td>
                  <td className="px-4 py-3">{row.phone ?? '미등록'}</td>
                  <td className="px-4 py-3">{row.gender ?? '미입력'}</td>
                  <td className="px-4 py-3">{row.interest ?? '미입력'}</td>
                  <td className="px-4 py-3">{row.role ?? 'user'}</td>
                  <td className="px-4 py-3">
                    {row.created_at ? new Date(row.created_at).toLocaleString('ko-KR') : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      )}
    </section>
  )
}
