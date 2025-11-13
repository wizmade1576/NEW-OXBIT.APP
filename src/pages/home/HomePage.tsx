import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import NewsListSkeleton from '../../components/skeletons/NewsListSkeleton'
import MarketListSkeleton from '../../components/skeletons/MarketListSkeleton'

export default function HomePage() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">홈</h2>
        <p className="text-muted-foreground text-sm">뉴스/속보/시세 요약 영역</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              최신 뉴스 <Badge>Hot</Badge>
            </CardTitle>
            <CardDescription>주요 헤드라인 요약</CardDescription>
          </CardHeader>
          <CardContent>
            <NewsListSkeleton items={4} />
            <div className="mt-4">
              <Button variant="secondary">뉴스 더보기</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>시세</CardTitle>
            <CardDescription>주요 코인 시세</CardDescription>
          </CardHeader>
          <CardContent>
            <MarketListSkeleton items={6} />
            <div className="mt-4">
              <Button>시세 보러가기</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

