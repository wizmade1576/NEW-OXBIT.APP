import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import getSupabase from '../../lib/supabase/client'
import { useAuthStore } from '@/store/useAuthStore'
import type { User } from '@supabase/supabase-js'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const debug = (import.meta.env.DEV || (import.meta as any).env.VITE_DEBUG_AUTH === 'true') as boolean

  async function ensureNickname(user: User) {
    const metadata = user.user_metadata as Record<string, unknown> | undefined
    if (metadata?.nickname) return
    const nicknameFromEmail = user.email?.split('@')[0] ?? '익명'
    const supabase = getSupabase()
    if (!supabase) return
    await supabase.auth.updateUser({ data: { nickname: nicknameFromEmail } })
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const supabase = getSupabase()
    if (!supabase) {
      setError('Supabase 환경 변수가 없습니다. .env의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 확인하세요')
      return
    }
    try {
      setLoading(true)
      // Quick connectivity check to avoid long hang when auth endpoint is blocked
      const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL as string | undefined
      if (supabaseUrl) {
        const healthUrl = supabaseUrl.replace(/\/$/, '') + '/auth/v1/health'
        if (debug) console.debug('[auth] health check', healthUrl)
        await Promise.race([
          // Use no-cors so CORS policy doesn't cause false negatives; any resolve counts as reachable
          fetch(healthUrl, { method: 'GET', mode: 'no-cors' as RequestMode }).catch((e) => e),
          new Promise((_, reject) => setTimeout(() => reject(new Error('auth-health-timeout')), 5000)),
        ]).catch((e) => {
          if (debug) console.debug('[auth] health error (non-blocking)', e)
          // Do not block sign-in; proceed and let timeout/error handling manage UX
        })
      }
      const signInPromise = supabase.auth.signInWithPassword({ email, password })
      if (debug) console.debug('[auth] signInWithPassword start', { email })
      const { data, error } = await Promise.race([
        signInPromise,
        new Promise<{ data: any; error: any }>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
      ]).catch((e) => {
        if (debug) console.debug('[auth] signIn error/race reject', e)
        throw e
      }) as { data: any; error: any }
      if (error) {
        const msg = String(error.message || '')
        if (msg.toLowerCase().includes('email') && msg.toLowerCase().includes('confirm')) {
          setError('이메일 인증이 필요합니다. 받은 메일함을 확인해주세요')
        } else {
          setError(msg || '로그인 중 오류가 발생했습니다')
        }
        if (debug) console.debug('[auth] signIn result error', error)
        return
      }
      if (!data?.session) {
        setError('세션 생성에 실패했습니다. 이메일 인증 여부와 네트워크를 확인하세요')
        if (debug) console.debug('[auth] signIn no session', data)
        return
      }
      if (data.session.user) {
        await ensureNickname(data.session.user)
        useAuthStore.getState().setUser(data.session.user)
      }
      if (debug) console.debug('[auth] signIn success, navigating')
      navigate('/')
    } catch (e: any) {
      const code = String(e?.message || '')
      if (code === 'timeout') setError('로그인 요청이 지연되고 있습니다. 네트워크를 확인하세요')
      else if (code === '인증 서버 응답 지연') setError('인증 서버 응답이 지연되고 있습니다 (5초). 네트워크/차단 여부를 확인하세요')
      else if (code === '인증 서버 연결 실패') setError('인증 서버에 연결하지 못했습니다. 프록시/VPN/방화벽을 확인하세요')
      else setError(code || '로그인 중 오류가 발생했습니다')
      if (debug) console.debug('[auth] catch', e)
    } finally {
      setLoading(false)
    }
  }

  async function oauthLogin(provider: 'google' | 'kakao') {
    setError(null)
    const supabase = getSupabase()
    if (!supabase) {
      setError('Supabase 환경 변수가 없습니다. .env의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 확인하세요')
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
    if (data?.url) {
      if (debug) console.debug('[auth] oauth redirect', { provider, url: data.url })
      window.location.href = data.url
    }
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
            <Button type="submit" className="w-full" disabled={loading}>{loading ? '로그인 중…' : '로그인'}</Button>
          </form>

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <button type="button" className="hover:underline" onClick={() => navigate('/signup')}>회원가입</button>
            <button type="button" className="hover:underline" onClick={() => navigate('/forgot')}>비밀번호 찾기</button>
          </div>

          <div className="my-4 h-px w-full bg-border" />
        </CardContent>
      </Card>
    </section>
  )
}
