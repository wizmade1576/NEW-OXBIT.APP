import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import SortFilterBar from '../../components/ui/SortFilterBar'
import ListItemCard from '../../components/ui/ListItemCard'
import InfiniteListSkeleton from '../../components/skeletons/InfiniteListSkeleton'
import useInfiniteScroll from '../../hooks/useInfiniteScroll'

export default function NewsPage() {
  const [items, setItems] = React.useState(Array.from({ length: 10 }, (_, i) => i))
  const { ref } = useInfiniteScroll({
    onIntersect: () => setTimeout(() => setItems((arr) => [...arr, ...Array.from({ length: 5 }, (_, i) => arr.length + i)]), 300),
  })

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold">뉴스</h2>
          <p className="text-muted-foreground text-sm">주요 뉴스 피드</p>
        </div>
        <SortFilterBar
          sortOptions={[
            { label: '최신순', value: 'latest' },
            { label: '인기순', value: 'hot' },
          ]}
          filters={['핫', '브레이킹', '긴급']}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>헤드라인</CardTitle>
          <CardDescription>실시간 업데이트</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.map((i) => (
              <ListItemCard
                key={i}
                title={`뉴스 타이틀 ${i + 1}`}
                description="요약 내용이 여기에 들어갑니다."
                metaLeft="2분 전 • CoinNis"
                metaRight="조회 1.2k"
                badges={i % 3 === 0 ? ['핫'] : undefined}
              />
            ))}
            <div ref={ref} />
            <InfiniteListSkeleton items={3} />
          </div>
        </CardContent>
      </Card>
    </section>
  )
}


