import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import SortFilterBar from '../../components/ui/SortFilterBar'
import ListItemCard from '../../components/ui/ListItemCard'
import InfiniteListSkeleton from '../../components/skeletons/InfiniteListSkeleton'
import useInfiniteScroll from '../../hooks/useInfiniteScroll'

export default function CommunityPage() {
  const [items, setItems] = React.useState(Array.from({ length: 9 }, (_, i) => i))
  const { ref } = useInfiniteScroll({ onIntersect: () => setTimeout(() => setItems((arr) => [...arr, ...Array.from({ length: 5 }, (_, i) => arr.length + i)]), 300) })
  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold">커뮤니티</h2>
          <p className="text-muted-foreground text-sm">토론, 의견, 피드</p>
        </div>
        <SortFilterBar
          sortOptions={[{ label: '최신순', value: 'latest' }, { label: '인기순', value: 'hot' }]}
          filters={['공지', '리뷰', '잡담']}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>게시물</CardTitle>
          <CardDescription>커뮤니티 피드 (연결 예정)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.map((i) => (
              <ListItemCard
                key={i}
                title={`게시물 제목 ${i + 1}`}
                description="내용 미리보기 텍스트"
                metaLeft="작성자 • 5분 전"
                metaRight={`댓글 ${i}`}
                badges={i % 4 === 0 ? ['공지'] : undefined}
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

