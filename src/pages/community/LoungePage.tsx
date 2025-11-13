import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import ListItemCard from '../../components/ui/ListItemCard'
import InfiniteListSkeleton from '../../components/skeletons/InfiniteListSkeleton'
import useInfiniteScroll from '../../hooks/useInfiniteScroll'

export default function LoungePage() {
  const [items, setItems] = React.useState<number[]>(Array.from({ length: 8 }, (_, i) => i))
  const { ref } = useInfiniteScroll({
    onIntersect: () => setTimeout(() => setItems((arr) => [...arr, ...Array.from({ length: 4 }, (_, i) => arr.length + i)]), 300),
  })

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>라운지</CardTitle>
          <CardDescription>자유 게시글, HOT, 이벤트</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="text-green-500">최신</span>
            <span>전체</span>
            <span>HOT</span>
            <span>EVENT 진행중</span>
          </div>
          <div className="space-y-3">
            {items.map((i) => {
              const views = (i + 1) * 37
              const comments = (i % 5) + 1
              const likes = (i * 3) % 50
              return (
                <ListItemCard
                  key={i}
                  title={`라운지 게시글 ${i + 1}`}
                  description={`요약 텍스트가 표시됩니다. 데모 컨텐츠 ${i + 1}.`}
                  metaLeft={`조회 ${views.toLocaleString()} · 댓글 ${comments}`}
                  metaRight={`좋아요 ${likes}`}
                />
              )
            })}
            <div ref={ref} />
            <InfiniteListSkeleton items={3} />
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

