import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import getSupabase from '../../lib/supabase/client'

function normalizePhone(input: string): string {
  const cleaned = input.replace(/[\s-]/g, '')
  if (!cleaned) return ''
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.startsWith('010')) {
    return '+82' + cleaned.slice(1)
  }
  return cleaned
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [gender, setGender] = React.useState<'male' | 'female' | ''>('')
  const [interest, setInterest] = React.useState<'coin' | 'stock' | 'both' | ''>('')
  const [nickname, setNickname] = React.useState('')
  const [otpCode, setOtpCode] = React.useState('')
  const [otpMessage, setOtpMessage] = React.useState<string | null>(null)
  const [otpSent, setOtpSent] = React.useState(false)
  const [phoneVerified, setPhoneVerified] = React.useState(false)
  const [verifiedPhone, setVerifiedPhone] = React.useState('')
  const [otpSending, setOtpSending] = React.useState(false)
  const [otpVerifying, setOtpVerifying] = React.useState(false)
  const [modal, setModal] = React.useState<null | 'tos' | 'privacy' | 'third'>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const debug = (import.meta.env.DEV || (import.meta as any).env.VITE_DEBUG_AUTH === 'true') as boolean

  const handlePhoneChange = React.useCallback((value: string) => {
    setPhone(value)
    setPhoneVerified(false)
    setVerifiedPhone('')
    setOtpSent(false)
    setOtpCode('')
    setOtpMessage(null)
  }, [])

  const handleSendOtp = React.useCallback(async () => {
    setError(null)
    setNotice(null)
    setOtpMessage(null)
    if (!phone) {
      setError('전화번호를 입력해주세요.')
      return
    }
    const normalizedPhone = normalizePhone(phone)
    if (!normalizedPhone) {
      setError('전화번호 형식이 올바르지 않습니다.')
      return
    }
    const supabase = getSupabase()
    if (!supabase) {
      setError('Supabase 설정을 확인해주세요. (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)')
      return
    }
    setOtpSending(true)
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone,
        options: { shouldCreateUser: true },
      })
      if (otpError) {
        setError(otpError.message || '인증번호를 발송할 수 없습니다.')
        return
      }
      setOtpSent(true)
      setOtpMessage('인증번호가 전송되었습니다. 휴대폰에서 확인해주세요.')
    } catch (e) {
      setError('인증번호 요청 중 오류가 발생했습니다.')
    } finally {
      setOtpSending(false)
    }
  }, [phone])

  const handleVerifyOtp = React.useCallback(async () => {
    setError(null)
    setNotice(null)
    setOtpMessage(null)
    if (!phone) {
      setError('전화번호를 입력해주세요.')
      return
    }
    if (!otpCode) {
      setError('인증번호를 입력해주세요.')
      return
    }
    const normalizedPhone = normalizePhone(phone)
    if (!normalizedPhone) {
      setError('전화번호 형식이 올바르지 않습니다.')
      return
    }
    const supabase = getSupabase()
    if (!supabase) {
      setError('Supabase 설정을 확인해주세요. (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)')
      return
    }
    setOtpVerifying(true)
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otpCode,
        type: 'sms',
      })
      if (verifyError) {
        setError(verifyError.message || '인증번호가 일치하지 않습니다.')
        return
      }
      setPhoneVerified(true)
      setVerifiedPhone(normalizedPhone)
      setOtpSent(false)
      setOtpCode('')
      setOtpMessage('전화번호 인증이 완료되었습니다.')
      await supabase.auth.signOut().catch(() => {})
    } catch (e) {
      setError('인증 확인 중 오류가 발생했습니다.')
    } finally {
      setOtpVerifying(false)
    }
  }, [phone, otpCode])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (!gender) {
      setError('성별을 선택해주세요.')
      return
    }
    if (!interest) {
      setError('관심분야를 선택해주세요.')
      return
    }
    const normalizedPhone = normalizePhone(phone)
    if (!normalizedPhone) {
      setError('전화번호를 입력해주세요.')
      return
    }
    if (!phoneVerified || normalizedPhone !== verifiedPhone) {
      setError('전화번호 인증을 완료해주세요.')
      return
    }
    const supabase = getSupabase()
    if (!supabase) {
      setError('Supabase 환경 변수를 확인해주세요. (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)')
      return
    }
    try {
      setLoading(true)
      const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL as string | undefined
      if (supabaseUrl) {
        const healthUrl = supabaseUrl.replace(/\/$/, '') + '/auth/v1/health'
        if (debug) console.debug('[auth] health check (signup)', healthUrl)
        await Promise.race([
          fetch(healthUrl, { method: 'GET', mode: 'no-cors' as RequestMode }).catch((e) => e),
          new Promise((_, reject) => setTimeout(() => reject(new Error('auth-health-timeout')), 5000)),
        ]).catch((e) => {
          if (debug) console.debug('[auth] health error (signup, non-blocking)', e)
        })
      }

      if (debug) console.debug('[auth] signUp start', { email })
      const signUpPromise = supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + '/login',
          data: { name, nickname, gender, interest, phone: normalizedPhone },
        },
      })
      const { data, error } = await Promise.race([
        signUpPromise,
        new Promise<{ data: any; error: any }>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
      ]).catch((e) => {
        throw e
      }) as { data: any; error: any }
      if (error) {
        setError(error.message || '가입 중 오류가 발생했습니다.')
        return
      }

      try {
        const userId = data?.user?.id
        if (userId) {
          await supabase.from('profiles').update({ name, nickname, gender, interest, phone: normalizedPhone }).eq('id', userId)
        }
      } catch {}

      setNotice('가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.')
      setTimeout(() => navigate('/login'), 1200)
    } catch (e: any) {
      const code = String(e?.message || '')
      if (code === 'timeout') setError('요청이 지연되었습니다. 네트워크를 확인해주세요.')
      else setError(code || '가입 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mx-auto max-w-md space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">회원가입</h2>
        <Link to="/login" className="text-sm text-primary hover:underline">
          로그인
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>회원가입</CardTitle>
          <CardDescription>필수 정보를 입력해 주세요</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? <div className="mb-3 text-sm text-red-400">{error}</div> : null}
          {notice ? <div className="mb-3 text-sm text-emerald-400">{notice}</div> : null}
          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                이메일 <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@example.com"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                비밀번호 <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
              <p className="text-xs text-muted-foreground">영문/숫자 조합 8자 이상을 권장합니다.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirm" className="text-sm font-medium">
                비밀번호 확인 <span className="text-red-500">*</span>
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">
                전화번호 <span className="text-red-500">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                required
                placeholder="010-0000-0000"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">전화번호 인증</label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={!phone || otpSending}
                  className="h-10 rounded-md border border-input bg-primary/10 px-3 text-sm font-medium text-white transition-colors disabled:opacity-50"
                >
                  {otpSending ? '요청 중...' : '인증번호 요청'}
                </button>
                <span className={`text-xs ${phoneVerified ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                  {phoneVerified ? '전화번호가 인증되었습니다.' : '전화번호 인증을 진행해주세요.'}
                </span>
              </div>
              {otpSent && !phoneVerified ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="인증번호"
                    className="flex-1 min-w-0 h-10 rounded-md border border-input bg-background px-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={!otpCode || otpVerifying}
                    className="h-10 rounded-md border border-input bg-primary/10 px-3 text-sm font-medium text-white transition-colors disabled:opacity-50"
                  >
                    {otpVerifying ? '확인 중...' : '인증 확인'}
                  </button>
                </div>
              ) : null}
              {otpMessage ? <p className="text-xs text-emerald-400">{otpMessage}</p> : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">성별</label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                >
                  <option value="">선택 안 함</option>
                  <option value="male">남성</option>
                  <option value="female">여성</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">관심 분야</label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value as any)}
                >
                  <option value="">선택 안 함</option>
                  <option value="coin">코인</option>
                  <option value="stock">주식</option>
                  <option value="both">코인+주식</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="nickname" className="text-sm font-medium">
                닉네임(선택)
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">약관 동의</div>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" required /> 이용약관 동의
                <a
                  className="text-primary hover:underline"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setModal('tos')
                  }}
                >
                  보기
                </a>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" required /> 개인정보 처리방침 동의
                <a
                  className="text-primary hover:underline"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setModal('privacy')
                  }}
                >
                  보기
                </a>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" /> 마케팅 정보 수신 동의
                <a
                  className="text-primary hover:underline"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setModal('third')
                  }}
                >
                  보기
                </a>
              </label>
            </div>

            <div className="my-2 h-px w-full bg-border" />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '처리 중...' : '계정 만들기'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal(null)} />
          <div className="relative z-10 w-[92%] max-w-2xl rounded-lg border border-border bg-card p-4 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {modal === 'tos' ? '이용약관' : modal === 'privacy' ? '개인정보 처리방침' : '마케팅 정보 수신 동의'}
              </h3>
              <button className="text-sm text-muted-foreground hover:underline" onClick={() => setModal(null)}>
                닫기
              </button>
            </div>
            <div className="h-[60vh] overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">
              {modal === 'tos' && (
                <>
                  OXBIT.APP 이용약관
                  ...
                </>
              )}
              {modal === 'privacy' && (
                <>
                  OXBIT.APP 개인정보 처리방침
                  ...
                </>
              )}
              {modal === 'third' && (
                <>
                  OXBIT.APP 마케팅 정보 수신 동의
                  ...
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
