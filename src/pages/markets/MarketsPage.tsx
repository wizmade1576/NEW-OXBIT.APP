import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import SortFilterBar from '../../components/ui/SortFilterBar'
import ListItemCard from '../../components/ui/ListItemCard'
import InfiniteListSkeleton from '../../components/skeletons/InfiniteListSkeleton'
import useInfiniteScroll from '../../hooks/useInfiniteScroll'

export default function MarketsPage() {
  const [items, setItems] = React.useState(Array.from({ length: 12 }, (_, i) => i))
  const { ref } = useInfiniteScroll({ onIntersect: () => setTimeout(() => setItems((arr) => [...arr, ...Array.from({ length: 6 }, (_, i) => arr.length + i)]), 300) })
  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold">마켓</h2>
          <p className="text-muted-foreground text-sm">주요 코인 시세</p>
        </div>
        <SortFilterBar
          sortOptions={[
            { label: '거래대금순', value: 'volume' },
            { label: '상승률순', value: 'change_desc' },
            { label: '하락률순', value: 'change_asc' },
          ]}
          filters={['BTC', 'ETH', 'ALT']}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>시세 목록</CardTitle>
          <CardDescription>가격, 등락, 거래량</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.map((i) => (
              <ListItemCard
                key={i}
                title={`BTC/KRW #${i + 1}`}
                description="52,430,000 KRW"
                metaLeft="24h +3.4%"
                metaRight="Vol 1.2B"
                rightSlot={<span className="text-success font-medium">+3.4%</span>}
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

