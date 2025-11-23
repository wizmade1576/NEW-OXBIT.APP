// React import not needed with react-jsx
import { Outlet, NavLink } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'

export default function MoreLayout() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">더보기</h2>
        <p className="text-muted-foreground text-sm">공지사항과 이용 가이드를 확인하세요</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>바로가기</CardTitle>
          <CardDescription>도움말과 공지 모음</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <NavLink to="notices" className="text-sm text-primary hover:underline">
              공지사항
            </NavLink>
            <NavLink to="guide" className="text-sm text-primary hover:underline">
              이용 가이드
            </NavLink>
          </div>
        </CardContent>
      </Card>

      <Outlet />
    </section>
  )
}
