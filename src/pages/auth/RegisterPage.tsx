import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import getSupabase from '../../lib/supabase/client'

const PROXY_URL = (import.meta as any).env?.VITE_PROXY_URL || 'https://otp.oxbit.app'
const PROXY_TOKEN = (import.meta as any).env?.VITE_PROXY_TOKEN || 'oxbit-secret'

function normalizePhone(input: string): string {
  return input.replace(/-/g, '').trim()
}

function formatPhoneForAuth(raw: string): string {
  let normalized = normalizePhone(raw)
  if (!normalized) return ""
  if (normalized.startsWith("0")) {
    normalized = "+82" + normalized.slice(1)
  } else if (!normalized.startsWith("+")) {
    normalized = "+82" + normalized
  }
  return normalized
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
  const [otpError, setOtpError] = React.useState<string | null>(null)
  const [otpSent, setOtpSent] = React.useState(false)
  const [phoneVerified, setPhoneVerified] = React.useState(false)
  const [sentCode, setSentCode] = React.useState<string | null>(null)
  const [verifiedPhone, setVerifiedPhone] = React.useState('')
  const [otpSending, setOtpSending] = React.useState(false)
  const [otpVerifying, setOtpVerifying] = React.useState(false)
  const [modal, setModal] = React.useState<null | 'tos' | 'privacy' | 'third'>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [verifyToken, setVerifyToken] = React.useState<string | null>(null)

  const passwordError = React.useMemo(() => {
    const pass = password.trim()
    const conf = confirm.trim()
    if (!pass && !conf) return null
    if (pass.length < 8) return '비밀번호는 8자 이상이어야 합니다.'
    if (!/[A-Za-z]/.test(pass) || !/[0-9]/.test(pass)) return '비밀번호는 영문과 숫자를 모두 포함해야 합니다.'
    if (pass !== conf) return '비밀번호와 비밀번호 확인이 일치하지 않습니다.'
    return null
  }, [password, confirm])

  const handlePhoneChange = React.useCallback((value: string) => {
    setPhone(value)
    setPhoneVerified(false)
    setVerifiedPhone('')
    setOtpSent(false)
    setOtpCode('')
    setOtpMessage(null)
    setOtpError(null)
    setSentCode(null)
    setVerifyToken(null)
  }, [])

  const mapOtpError = React.useCallback((code: string) => {
    if (!code) return '요청에 실패했습니다. 잠시 후 다시 시도해 주세요.'
    const c = code.toLowerCase()
    if (c.includes('rate_limited')) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    if (c.includes('invalid_phone')) return '전화번호 형식을 확인해 주세요.'
    if (c.includes('otp_expired')) return '인증번호가 만료되었습니다. 다시 요청해 주세요.'
    if (c.includes('otp_mismatch')) return '인증번호가 올바르지 않습니다.'
    if (c.includes('otp_not_found')) return '인증번호를 먼저 요청해 주세요.'
    if (c.includes('too_many_attempts')) return '시도 횟수가 초과되었습니다. 잠시 후 다시 시도해 주세요.'
    if (c.includes('verification_required')) return '전화번호 인증을 완료해 주세요.'
    if (c.includes('verification_expired')) return '전화번호 인증이 만료되었습니다. 다시 인증해 주세요.'
    if (c.includes('missing_supabase_credentials')) return '서버 설정(Supabase)을 확인해 주세요. 관리자에게 문의하세요.'
    if (c.includes('aligo_send_failed')) return '인증번호 발송에 실패했습니다. 알리고 설정을 확인해 주세요.'
    if (c.includes('request_failed')) return '요청에 실패했습니다. 잠시 후 다시 시도해 주세요.'
    return '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  }, [])

  const handleSendOtp = React.useCallback(async () => {
    setError(null)
    setNotice(null)
    setOtpMessage(null)
    setOtpError(null)
    const normalizedPhone = normalizePhone(phone)
    if (!normalizedPhone) {
      setError('전화번호 형식을 확인해 주세요.')
      return
    }
    setOtpSending(true)
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      setSentCode(code)
      const headers: HeadersInit = {
        'content-type': 'application/json',
        ...(PROXY_TOKEN ? { 'x-proxy-token': PROXY_TOKEN } : {}),
      }
      const res = await fetch(`${PROXY_URL.replace(/\/$/, '')}/send-otp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone: normalizedPhone,
          msg: `[OXBIT] 인증번호는 ${code} 입니다.`,
        }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || 'request_failed_proxy')
      }
      setOtpSent(true)
      setOtpMessage('인증번호가 발송되었습니다. 문자 메시지를 확인해 주세요.')
    } catch (e: any) {
      const msg = mapOtpError(String(e?.message || ''))
      setError(msg)
      setOtpError(msg)
    } finally {
      setOtpSending(false)
    }
  }, [mapOtpError, phone])

  const handleVerifyOtp = React.useCallback(async () => {
    setError(null)
    setNotice(null)
    setOtpMessage(null)
    setOtpError(null)
    const normalizedPhone = normalizePhone(phone)
    if (!normalizedPhone) {
      setError('전화번호 형식을 확인해 주세요.')
      return
    }
    if (!otpCode) {
      setError('인증번호를 입력해 주세요.')
      return
    }
    setOtpVerifying(true)
    try {
      if (!sentCode) throw new Error('요청된 인증번호가 없습니다.')
      if (otpCode.trim() !== sentCode) throw new Error('인증번호가 올바르지 않습니다.')
      setPhoneVerified(true)
      setVerifiedPhone(normalizedPhone)
      setVerifyToken(sentCode)
      setOtpSent(false)
      setOtpCode('')
      setOtpMessage('전화번호 인증이 완료되었습니다.')
    } catch (e: any) {
      const msg = mapOtpError(String(e?.message || ''))
      setError(msg)
      setOtpError(msg)
    } finally {
      setOtpVerifying(false)
    }
  }, [mapOtpError, phone, otpCode, sentCode])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setError(null);
  setNotice(null);

  // ===== 기본 입력 검증 =====
  const pass = password.trim();
  const conf = confirm.trim();

  if (!email || !email.includes("@")) {
    setError("이메일을 올바르게 입력해 주세요.");
    return;
  }
  if (pass.length < 8 || !/[A-Za-z]/.test(pass) || !/[0-9]/.test(pass)) {
    setError("비밀번호는 영문/숫자 조합 8자 이상이어야 합니다.");
    return;
  }
  if (pass !== conf) {
    setError("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
    return;
  }
  if (!gender) {
    setError("성별을 선택해 주세요.");
    return;
  }
  if (!interest) {
    setError("관심분야를 선택해 주세요.");
    return;
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    setError("전화번호를 입력해 주세요.");
    return;
  }
  if (!phoneVerified || normalizedPhone !== verifiedPhone || !verifyToken) {
    setError("전화번호 인증을 완료해 주세요.");
    return;
  }

  const authPhone = formatPhoneForAuth(verifiedPhone);
  const supabase = getSupabase();
  if (!supabase) {
    setError("Supabase 설정 오류 (환경변수 확인 필요)");
    return;
  }

  setLoading(true);

  try {
    // ===========================
    // 1) Supabase 회원가입
    // ===========================
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          nickname: nickname || null,
        },
      },
    });

    if (signupError) {
      setError(signupError.message);
      return;
    }

    const user = signupData.user;
if (!user) {
  setError("회원가입은 되었지만 사용자 정보가 없습니다.");
  return;
}

// ===========================
// 2) 🔥 Supabase Auth에 전화번호 저장
// ===========================
try {
  const { error: updateErr } = await supabase.auth.updateUser({
    phone: authPhone,  // "+82..." 형식
  });

  if (updateErr) {
    console.error("Auth 전화번호 저장 오류:", updateErr);
  }
} catch (e) {
  console.error("Auth 전화번호 업데이트 중 오류:", e);
}

// ===========================
// 3) user_profile upsert
// ===========================
const { error: profileErr } = await supabase.from("user_profile").upsert(
{
  id: user.id,
  name,
  nickname: nickname || null,
  phone: authPhone,
  gender,
  interest,
  role: "user",
  created_at: new Date().toISOString(),
},
{ onConflict: "id" }
);


    // ===========================
    // 4) 성공 → 안내 후 로그인 페이지 이동
    // ===========================
    setNotice("회원가입이 완료되었습니다. 이메일을 확인해주세요.");
    navigate('/profile', { state: { welcomeMessage: '회원가입을 축하합니다! 프로필 정보를 확인하거나 정보를 수정해보세요.' } })

  } catch (err: any) {
    console.error("회원가입 처리 오류:", err);
    setError("알 수 없는 오류가 발생했습니다.");
  } finally {
    setLoading(false);
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
          <CardDescription>필수 정보를 입력해 주세요.</CardDescription>
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
              {passwordError && confirm.trim().length > 0 ? (
                <p className="text-xs text-red-400">{passwordError}</p>
              ) : null}
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
                  {phoneVerified ? '전화번호가 인증되었습니다.' : '전화번호 인증을 진행해 주세요.'}
                </span>
              </div>
              {otpError ? <p className="text-xs text-red-400">{otpError}</p> : null}
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
                <label className="text-sm font-medium">관심분야</label>
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
            <Button type="submit" className="w-full" disabled={loading || !!passwordError}>
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
