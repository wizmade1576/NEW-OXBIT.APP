import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('')

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // TODO: Supabase reset-password 이메일 전송 연동 예정
    // eslint-disable-next-line no-alert
    alert(`비밀번호 재설정 메일 전송: ${email}`)
  }

  return (
    <section className="mx-auto max-w-md space-y-6">
      <div>
        <h2 className="text-xl font-semibold">비밀번호 찾기</h2>
        <p className="text-muted-foreground text-sm">이메일로 재설정 링크를 보내드립니다</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>재설정 링크 보내기</CardTitle>
          <CardDescription>가입하신 이메일을 입력하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm" htmlFor="email">이메일</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>
            <Button type="submit" className="w-full">메일 보내기</Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}

