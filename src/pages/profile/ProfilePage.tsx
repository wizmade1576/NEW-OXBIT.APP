import * as React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import getSupabase from '../../lib/supabase/client'
import { useAuthStore } from '@/store/useAuthStore'

const DEFAULT_PROFILE = {
  name: '',
  nickname: '',
  phone: '',
  gender: '',
  interest: '',
  role: 'user',
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const [profile, setProfile] = React.useState(DEFAULT_PROFILE)
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [note, setNote] = React.useState<string | null>(() => (location.state as any)?.welcomeMessage ?? null)

  React.useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return
      setLoading(true)
      setError(null)
      try {
        const supabase = getSupabase()
        if (!supabase) throw new Error('Supabase 클라이언트를 찾을 수 없습니다.')
        const { data, error } = await supabase
          .from('user_profile')
          .select('name,nickname,phone,gender,interest,role')
          .eq('id', user.id)
          .single()
        if (error && error.code !== 'PGRST116') throw error
        if (data) {
          setProfile({
            name: data.name ?? '',
            nickname: data.nickname ?? '',
            phone: data.phone ?? '',
            gender: data.gender ?? '',
            interest: data.interest ?? '',
            role: data.role ?? 'user',
          })
        }
      } catch (err: any) {
        setError(err?.message || '프로필을 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }
    void fetchProfile()
  }, [user])

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      setError('로그인이 필요합니다.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Supabase 클라이언트를 찾을 수 없습니다.')
      const { error } = await supabase.from('user_profile').upsert(
        {
          id: user.id,
          name: profile.name,
          nickname: profile.nickname || null,
          phone: profile.phone,
          gender: profile.gender,
          interest: profile.interest,
          role: profile.role || 'user',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      if (error) throw error
      setNote('프로필이 저장되었습니다.')
    } catch (err: any) {
      setError(err?.message || '프로필 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <section className="mx-auto max-w-xl space-y-6">
        <div>
          <h2 className="text-xl font-semibold">로그인이 필요합니다</h2>
          <p className="text-muted-foreground text-sm">프로필을 확인하려면 로그인해주세요.</p>
        </div>
        <Link className="text-sm text-primary hover:underline" to="/login">
          로그인하러 가기
        </Link>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold">내 프로필</h2>
        <p className="text-muted-foreground text-sm">가입한 정보를 확인하거나 수정할 수 있습니다.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>유저 정보</CardTitle>
          <CardDescription>아래 내용을 수정하고 저장하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          {note ? <div className="mb-3 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{note}</div> : null}
          {error ? <div className="mb-3 text-sm text-red-400">{error}</div> : null}
          <form className="space-y-4" onSubmit={handleSave}>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">이메일</label>
              <div className="px-3 py-2 rounded-md bg-background text-sm text-foreground border border-border">
                {user?.email ?? '등록된 이메일이 없습니다.'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="profile-name">
                이름
              </label>
              <input
                id="profile-name"
                type="text"
                value={profile.name}
                onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="profile-nickname">
                닉네임
              </label>
              <input
                id="profile-nickname"
                type="text"
                value={profile.nickname}
                onChange={(e) => setProfile((prev) => ({ ...prev, nickname: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="profile-phone">
                전화번호
              </label>
              <input
                id="profile-phone"
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="profile-gender">
                  성별
                </label>
                <select
                  id="profile-gender"
                  value={profile.gender}
                  onChange={(e) => setProfile((prev) => ({ ...prev, gender: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">선택</option>
                  <option value="male">남성</option>
                  <option value="female">여성</option>
                  <option value="other">기타</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="profile-interest">
                  관심분야
                </label>
                <select
                  id="profile-interest"
                  value={profile.interest}
                  onChange={(e) => setProfile((prev) => ({ ...prev, interest: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">선택</option>
                  <option value="coin">코인</option>
                  <option value="stock">주식</option>
                  <option value="both">코인 + 주식</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">권한</label>
              <div className="px-3 py-2 rounded-md bg-background text-sm text-foreground border border-border">{profile.role}</div>
            </div>
            <Button type="submit" className="w-full" disabled={saving || loading}>
              {saving ? '저장 중...' : '프로필 저장'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
