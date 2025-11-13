import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import getSupabase from '../../lib/supabase/client'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [code, setCode] = React.useState('')
  const [gender, setGender] = React.useState<'male' | 'female' | ''>('')
  const [interest, setInterest] = React.useState<'coin' | 'stock' | 'both' | ''>('')
  const [nickname, setNickname] = React.useState('')
  const [modal, setModal] = React.useState<null | 'tos' | 'privacy' | 'third'>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다')
      return
    }
    const supabase = getSupabase()
    if (!supabase) {
      setError('Supabase 환경 변수가 없습니다. .env의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 확인하세요.')
      return
    }
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + '/login',
          data: { name, nickname, gender, interest, phone },
        },
      })
      if (error) { setError(error.message || '가입 중 오류가 발생했습니다'); return }
      // 프로필 추가정보 업데이트(사용자 ID가 있는 경우)
      const userId = data.user?.id
      if (userId) {
        await supabase.from('profiles').update({ name, nickname, gender, interest, phone }).eq('id', userId)
      }
      setNotice('가입이 완료되었습니다. 이메일 인증 후 로그인하세요.')
      setTimeout(() => navigate('/login'), 1200)
    } finally {
      setLoading(false)
    }
  }

  function sendCode() {
    alert('인증번호가 전송되었습니다 (데모)')
  }

  return (
    <section className="mx-auto max-w-md space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">회원가입</h2>
        <Link to="/login" className="text-sm text-primary hover:underline">로그인</Link>
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
              <label htmlFor="email" className="text-sm font-medium">아이디(이메일) <span className="text-red-500">*</span></label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@example.com" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">비밀번호 <span className="text-red-500">*</span></label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
              <p className="text-xs text-muted-foreground">영문/숫자 조합 8자 이상을 권장합니다</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirm" className="text-sm font-medium">비밀번호 확인 <span className="text-red-500">*</span></label>
              <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>

            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">이름 <span className="text-red-500">*</span></label>
              <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">전화번호 <span className="text-red-500">*</span></label>
              <div className="flex items-center gap-2">
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="예) 01012345678" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
                <Button type="button" variant="outline" size="md" className="h-10 px-4 whitespace-nowrap" onClick={sendCode}>인증번호</Button>
              </div>
              <div className="flex items-center gap-2">
                <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6자리 입력" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
                <Button type="button" variant="secondary" size="md" className="h-10 px-4 whitespace-nowrap">확인</Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">성별</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={gender === 'male'} onChange={() => setGender(gender === 'male' ? '' : 'male')} /> 남성
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={gender === 'female'} onChange={() => setGender(gender === 'female' ? '' : 'female')} /> 여성
                </label>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <label className="text-sm font-medium">관심분야</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={interest === 'coin'} onChange={() => setInterest(interest === 'coin' ? '' : 'coin')} /> 코인
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={interest === 'stock'} onChange={() => setInterest(interest === 'stock' ? '' : 'stock')} /> 주식
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={interest === 'both'} onChange={() => setInterest(interest === 'both' ? '' : 'both')} /> 코인+주식
                </label>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <label htmlFor="nickname" className="text-sm font-medium">닉네임(선택)</label>
              <input id="nickname" type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>

            <div className="space-y-2 mt-4">
              <label className="text-sm font-medium">약관</label>
              <div className="flex flex-col gap-2 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" required /> 이용약관 동의
                  <a className="text-primary hover:underline" href="#" onClick={(e) => { e.preventDefault(); setModal('tos') }}>보기</a>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" required /> 개인정보처리 동의
                  <a className="text-primary hover:underline" href="#" onClick={(e) => { e.preventDefault(); setModal('privacy') }}>보기</a>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" /> 제3자 정보 제공 동의
                  <a className="text-primary hover:underline" href="#" onClick={(e) => { e.preventDefault(); setModal('third') }}>보기</a>
                </label>
              </div>
            </div>

            <div className="my-2 h-px w-full bg-border" />
            <Button type="submit" className="w-full" disabled={loading}>{loading ? '가입 처리 중...' : '계정 만들기'}</Button>
          </form>
        </CardContent>
      </Card>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal(null)} />
          <div className="relative z-10 w-[92%] max-w-2xl rounded-lg border border-border bg-card p-4 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {modal === 'tos' ? '이용약관' : modal === 'privacy' ? '개인정보처리 동의' : '추가 제3자 정보 제공 동의'}
              </h3>
              <button className="text-sm text-muted-foreground hover:underline" onClick={() => setModal(null)}>닫기</button>
            </div>
            <div className="h-[60vh] overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">
              {modal === 'tos' && (
                <>
[이용약관]

제1조 (목적)
본 약관은 서비스 제공자(이하 "회사")가 제공하는 서비스 이용과 관련하여 회사와 이용자 간의 권리, 의무를 규정함을 목적으로 합니다.

제2조 (용어 정의)
1. "서비스"란 회사가 제공하는 모든 온라인 서비스 및 기능을 의미합니다.
2. "이용자"란 본 약관에 따라 서비스를 이용하는 회원을 말합니다.

제3조 (약관의 효력)
본 약관은 서비스 내 게시함으로써 효력이 발생합니다. 회사는 관련 법률을 준수하며 약관을 변경할 수 있습니다.

제4조 (서비스 제공)
회사는 안정적인 서비스 제공을 위해 최선을 다하며, 운영상의 이유로 서비스 내용이 변경될 수 있습니다.

제5조 (이용자의 의무)
이용자는 관련 법령, 본 약관, 서비스 이용 안내를 준수하여야 합니다.

제6조 (서비스 이용 제한)
이용자가 법령 또는 약관을 위반하는 경우 회사는 서비스 이용을 제한할 수 있습니다.

제7조 (면책 조항)
회사는 천재지변, 시스템 장애 등 불가항력적인 사유로 인한 손해에 대해 책임을 지지 않습니다.

부칙
본 약관은 2025년 11월 01일부터 시행합니다.
                </>
              )}
              {modal === 'privacy' && (
                <>
[개인정보 처리방침]

1. 수집하는 개인정보 항목
- 이메일, 비밀번호, 닉네임(선택), 접속기록, 이용기록 등

2. 개인정보의 수집 및 이용 목적
- 회원 가입 및 관리
- 서비스 제공 및 품질 향상
- 고객 문의 대응

3. 개인정보 보유 및 이용 기간
회원 탈퇴 시 또는 관련 법령에 의한 보관기간 이후 즉시 파기합니다.

4. 제3자 제공 및 위탁
회사는 이용자 동의 없이는 개인정보를 제3자에게 제공하지 않습니다.

5. 이용자의 권리
이용자는 자신의 개인정보 열람, 정정, 삭제를 요청할 수 있습니다.

부칙
본 개인정보처리방침은 2025년 11월 01일부터 적용됩니다.
                </>
              )}
              {modal === 'third' && (
                <>
[제3자 정보제공 동의]

회사는 다음과 같은 목적을 위해 이용자의 개인정보를 제3자에게 제공할 수 있습니다.

1. 제공받는 자
- 데이터 분석 서비스 제공업체
- 알림/SMS 발송 서비스 제공업체
- 결제대행사(해당 시)

2. 제공하는 개인정보 항목
- 이메일, 서비스 이용기록, 접속기록, IP, 닉네임(선택 시)

3. 제공 목적
- 서비스 운영, 데이터 분석, 고객 응대, 마케팅 알림 발송 등

4. 보유 및 이용 기간
- 제3자 제공 목적 달성 후 즉시 파기
(단, 법령에 따라 필요한 경우 해당 규정에 따름)

이용자는 위 내용에 대해 동의하지 않을 수 있으나, 동의하지 않을 경우 서비스 이용에 제한이 발생할 수 있습니다.

부칙
본 제3자 정보제공 동의는 2025년 11월 01일부터 시행합니다.
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
