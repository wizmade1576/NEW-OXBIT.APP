// React import not needed with react-jsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'

export default function GuidePage() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">이용 가이드</h2>
        <p className="text-muted-foreground text-sm">서비스 사용법과 모범 사례</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>시작하기</CardTitle>
          <CardDescription>핵심 기능 빠르게 둘러보기</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            <li>상단 메뉴로 주요 페이지 이동</li>
            <li>다크/라이트 테마 전환은 우측 상단</li>
            <li>검색창에서 키워드로 뉴스/속보 검색</li>
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}
