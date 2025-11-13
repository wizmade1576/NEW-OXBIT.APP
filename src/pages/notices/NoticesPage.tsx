// React import not needed with react-jsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import ListItemCard from '../../components/ui/ListItemCard'

export default function NoticesPage() {
  const items = Array.from({ length: 6 }, (_, i) => i)
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">공지사항</h2>
        <p className="text-muted-foreground text-sm">서비스 업데이트와 중요한 안내</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>최근 공지</CardTitle>
          <CardDescription>업데이트 로그와 점검 알림</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.map((i) => (
              <ListItemCard
                key={i}
                title={`공지 ${i + 1}`}
                description="내용 미리보기"
                metaLeft="OXBIT 운영팀"
                metaRight="2시간 전"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
