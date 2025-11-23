import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'

export default function AdsPage() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">광고</h2>
        <p className="text-muted-foreground text-sm">광고 영역/캠페인 관리 (관리자 전용 예정)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>광고 관리</CardTitle>
          <CardDescription>노출 위치, 기간, 소재 설정</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">초기 UI 자리표시자입니다. 추후 관리자 권한과 연동합니다.</p>
        </CardContent>
      </Card>
    </section>
  )
}

