import { useSearchParams } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import NewsListSkeleton from '../../components/skeletons/NewsListSkeleton'

export default function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold">검색</h2>
          <p className="text-muted-foreground text-sm">키워드로 뉴스/속보 검색</p>
        </div>
        <Button variant="secondary">필터</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>검색어</CardTitle>
          <CardDescription>{q ? `"${q}" 결과` : '검색어가 없습니다'}</CardDescription>
        </CardHeader>
        <CardContent>
          <NewsListSkeleton items={6} />
        </CardContent>
      </Card>
    </section>
  )
}

