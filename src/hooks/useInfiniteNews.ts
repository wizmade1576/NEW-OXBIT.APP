import * as React from 'react'
import { fetchTopic } from '../lib/news/providers'

export type Topic = 'crypto' | 'stocks' | 'fx'

export type NewsItem = {
  id: string
  title: string
  summary?: string
  url: string
  image?: string
  date: string
  source: string
}

export function useInfiniteNews(params: {
  topic: Topic
  pageSize?: number
  cacheKey?: string
}) {
  const { topic, pageSize = 20, cacheKey = `news:${topic}:v3` } = params

  const [items, setItems] = React.useState<NewsItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [page, setPage] = React.useState<number>(1)
  const [cursor, setCursor] = React.useState<string | undefined>(undefined)
  const [hasMore, setHasMore] = React.useState<boolean>(true)

  const busy = React.useRef(false)

  // 세션 캐시 초기 적용
  React.useEffect(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null')
      if (cached?.items) setItems(cached.items)
    } catch {}
  }, [cacheKey])

  // topic 변경 → 전체 리셋
  React.useEffect(() => {
    setItems([])
    setPage(1)
    setCursor(undefined)
    setHasMore(true)
    setError(null)
    busy.current = false
  }, [topic])

  const fetchNext = React.useCallback(async () => {
    if (busy.current || !hasMore) return

    busy.current = true
    setLoading(true)

    try {
  // 🔍 요청 로그 찍기
  console.log("🔍 fetchTopic 요청:", {
    topic,
    cursor,
    page,
    pageSize,
  })

  const resp = await fetchTopic(topic, cursor ?? page, pageSize)

  // 🔍 응답 로그 찍기
  console.log("🔍 fetchTopic 응답:", resp)

  const list: NewsItem[] = Array.isArray(resp?.items) ? resp.items : []

  const nextPage = (resp?.nextPage ?? null) || undefined
  const nextCursor = (resp as any)?.nextCursor as string | undefined

  setItems(prev => (page === 1 ? list : prev.concat(list)))

  if (nextPage) setPage(nextPage)
  if (nextCursor) setCursor(nextCursor)
  setHasMore(Boolean(nextPage || nextCursor))


      // 캐싱
      try {
        if (page === 1 && list.length)
          sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), items: list }))
      } catch {}
    } catch (e: any) {
      setError(e?.message || 'fetch_error')
      setHasMore(false)
    } finally {
      setLoading(false)
      busy.current = false
    }
  }, [topic, page, cursor, pageSize, hasMore, cacheKey])

  // 👇 자동 fetch 없음 (NewsPage에서 호출)
  return { items, loading, error, hasMore, fetchNext, setItems, setLoading }
}

export default useInfiniteNews
