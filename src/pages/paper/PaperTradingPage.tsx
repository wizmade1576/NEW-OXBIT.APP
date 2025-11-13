// React import not needed with react-jsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'

export default function PaperTradingPage() {
  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold">모의투자</h2>
          <p className="text-muted-foreground text-sm">가상 자산으로 전략을 테스트하세요</p>
        </div>
        <Button>시작하기</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>전략 보드</CardTitle>
          <CardDescription>백테스트/실시간 모의주문 연동 예정</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">초기 화면 구성용 자리 표시입니다.</p>
        </CardContent>
      </Card>
    </section>
  )
}
