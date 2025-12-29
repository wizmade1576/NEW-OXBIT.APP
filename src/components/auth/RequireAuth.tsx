import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import Button from '../ui/Button'

export default function RequireAuth() {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const sessionChecked = useAuthStore((state) => state.sessionChecked)

  const previewLabels: Record<string, string> = {
    '/': '실시간 브레이킹 뉴스',
    '/breaking': '브레이킹 피드',
    '/news': '뉴스',
    '/markets': '마켓 데이터',
    '/positions': '포지션 시세',
    '/paper': '페이퍼 트레이딩',
    '/more': '기타 정보',
  }

  const basePath = location.pathname.split('/').filter(Boolean)[0]
  const key = basePath ? `/${basePath}` : '/'
  const friendlyName = previewLabels[key] ?? '프리미엄 콘텐츠'

  const overlayMessage = sessionChecked ? (
    <span className="hidden text-sm text-muted-foreground sm:block">
      <span className="mr-1 text-foreground">{friendlyName}</span>을(를) 계속 보고 싶다면 로그인해 주세요.
    </span>
  ) : (
    '로그인 상태를 확인하는 중입니다…'
  )

  return (
    <div className="relative">
      <Outlet />
      {!user && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-background/90 p-4 sm:p-6">
          <div className="w-full max-w-[320px] space-y-4 rounded-2xl border border-border bg-card/95 p-6 text-center shadow-xl backdrop-blur sm:max-w-md sm:p-8">
            <div className="hidden text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:block">
              로그인 필요
            </div>
            <div className="hidden text-lg font-semibold text-foreground sm:block">
              {sessionChecked ? friendlyName : '세션 준비 중'}
            </div>
            <p className="text-sm text-muted-foreground">{overlayMessage}</p>
            <div className="hidden h-32 items-center justify-center rounded-lg border border-dashed border-muted-foreground bg-gradient-to-br from-muted/10 to-transparent text-xs text-muted-foreground sm:flex">
              {sessionChecked ? `${friendlyName} 미리보기` : '세션을 준비 중입니다…'}
            </div>
            <div className="space-y-2">
              {sessionChecked ? (
                <>
                  <Link to={`/login?next=${encodeURIComponent(location.pathname)}`}>
                    <Button className="w-full">로그인하고 계속 보기</Button>
                  </Link>
                  <Link to="/signup" className="text-xs text-primary hover:underline">
                    아직 계정이 없으세요? 회원가입
                  </Link>
                </>
              ) : (
                <Button className="w-full" disabled>
                  세션 확인 중…
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
