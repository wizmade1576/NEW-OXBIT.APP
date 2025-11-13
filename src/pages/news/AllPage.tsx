import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import InfiniteListSkeleton from '../../components/skeletons/InfiniteListSkeleton'
import useInfiniteScroll from '../../hooks/useInfiniteScroll'
import { fetchAllTopics, type CursorState, type PageState } from '../../lib/news/aggregate'

export default function AllPage() {
  const [items, setItems] = React.useState<any[]>([])
  const [cursor, setCursor] = React.useState<CursorState>({})
  const [page, setPage] = React.useState<PageState>({ crypto: 1, stocks: 1, fx: 1 })
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [sort, setSort] = React.useState<'latest'|'hot'>('latest')
  const [activeFilters, setActiveFilters] = React.useState<string[]>([])
  const [q, setQ] = React.useState('')
  const { ref } = useInfiniteScroll({ onIntersect: () => { if (!loading) void loadMore() } })

  const loadMore = React.useCallback(async () => {
    try {
      setLoading(true)
      const { items: more, cursor: nextC, page: nextP } = await fetchAllTopics({ cursor, page, limitPerTopic: 5 })
      setItems(prev => [...prev, ...more])
      setCursor(nextC)
      setPage(nextP)
    } catch (e: any) {
      setError(e?.message || '불러오기에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [cursor, page])

  React.useEffect(() => { if (items.length === 0 && !loading) void loadMore() }, [])

  const filtered = React.useMemo(() => {
    let list = items.slice()
    const qq = q.trim().toLowerCase()
    if (activeFilters.length) list = list.filter(n => activeFilters.some(f => n.title?.toLowerCase().includes(f.toLowerCase())))
    if (qq) list = list.filter(n => n.title?.toLowerCase().includes(qq) || (n.summary||'').toLowerCase().includes(qq))
    if (sort === 'latest') list.sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime())
    return list
  }, [items, activeFilters, q, sort])

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h3 className="text-xl font-semibold">전체</h3>
          <p className="text-muted-foreground text-sm">암호화폐 · 해외증시 · 환율/금리 종합</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={sort} onChange={(e)=>setSort(e.target.value as any)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="latest">최신</option>
            <option value="hot">인기</option>
          </select>
          <div className="flex flex-wrap items-center gap-2">
            {['BTC','ETH','미국','유럽','아시아','USD','금리'].map(f=> (
              <button key={f} onClick={()=> setActiveFilters(prev=> prev.includes(f)? prev.filter(x=>x!==f): [...prev, f])} className={(activeFilters.includes(f)?'bg-primary text-primary-foreground border-primary':'bg-background text-foreground hover:bg-accent') + ' rounded-md border px-2 py-1 text-xs'}>{f}</button>
            ))}
          </div>
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="검색어" className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>피드</CardTitle>
          <CardDescription>공급자 API/Reddit 폴백 기반</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? <div className="text-sm text-red-400">{error}</div> : null}
          <div className="space-y-4">
            {filtered.map((n) => (
              <article key={n.id} className="rounded-lg bg-[#121212] hover:bg-[#1e1e1e] transition-colors p-4 md:p-5">
                <a href={n.url} target="_blank" rel="noreferrer" className="flex flex-col md:flex-row items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base md:text-lg font-bold text-white line-clamp-2">{n.title}</h4>
                    {n.summary ? <p className="mt-2 text-sm text-[#aaa] line-clamp-2">{n.summary}</p> : null}
                    <div className="mt-2 text-xs text-gray-400"><span>{n.date}</span><span className="ml-2">{n.source}</span></div>
                  </div>
                  <div className="w-full h-40 md:w-48 md:h-28 overflow-hidden rounded-md bg-neutral-800 shrink-0">
                    {n.image ? <img src={n.image} alt={n.title} className="w-full h-full object-cover" /> : null}
                  </div>
                </a>
              </article>
            ))}
            <div ref={ref} />
            {loading ? <InfiniteListSkeleton items={3} /> : null}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

