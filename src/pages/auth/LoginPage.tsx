import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import getSupabase from '../../lib/supabase/client'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const supabase = getSupabase()
    if (!supabase) {
      setError('Supabase 환경 변수가 없습니다. .env의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 확인하세요.')
      return
    }
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message || '로그인 중 오류가 발생했습니다')
        return
      }
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  async function oauthLogin(provider: 'google' | 'kakao') {
    setError(null)
    const supabase = getSupabase()
    if (!supabase) {
      setError('Supabase 환경 변수가 없습니다. .env의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 확인하세요.')
      return
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setError('소셜 로그인 중 오류가 발생했습니다')
      return
    }
    if (data?.url) window.location.href = data.url
  }

  return (
    <section className="mx-auto max-w-md space-y-6">
      <div>
        <h2 className="text-xl font-semibold">로그인</h2>
        <p className="text-muted-foreground text-sm">계정으로 로그인하세요</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>OXBIT.APP 계정</CardTitle>
          <CardDescription>이메일과 비밀번호를 입력하세요</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? <div className="mb-3 text-sm text-red-400">{error}</div> : null}
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm" htmlFor="email">이메일</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm" htmlFor="password">비밀번호</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? '로그인 중...' : '로그인'}</Button>
          </form>

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <button type="button" className="hover:underline" onClick={() => navigate('/signup')}>회원가입</button>
            <button type="button" className="hover:underline" onClick={() => navigate('/forgot')}>비밀번호 찾기</button>
          </div>

          <div className="my-4 h-px w-full bg-border" />
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" onClick={() => oauthLogin('google')}>
              <span className="mr-2">G</span> Google
            </Button>
            <Button type="button" variant="outline" onClick={() => oauthLogin('kakao')}>
              <span className="mr-2">K</span> KakaoTalk
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

