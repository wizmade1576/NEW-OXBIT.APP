import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'

export default function AdsPage() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">광고</h2>
        <p className="text-muted-foreground text-sm">광고 영역/캠페인 관리(관리자 전용 예정)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>광고 관리</CardTitle>
          <CardDescription>출 위치, 기간, 재생 예정</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            초기 UI 준비 중입니다. 추후 관리자 권한으로 동작할 예정입니다.
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
