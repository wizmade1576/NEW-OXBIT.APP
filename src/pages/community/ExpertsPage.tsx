// React import not needed with react-jsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import ListItemCard from '../../components/ui/ListItemCard'

export default function ExpertsPage() {
  const items = Array.from({ length: 6 }, (_, i) => i)
  return (
    <section className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>전문가</CardTitle>
          <CardDescription>전문가 분석/코멘트 피드</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.map((i) => (
              <ListItemCard
                key={i}
                title={`전문가 코멘트 ${i + 1}`}
                description="시장 인사이트가 여기에 제공됩니다"
                metaLeft={`전문가A • ${i + 2}시간 전`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
