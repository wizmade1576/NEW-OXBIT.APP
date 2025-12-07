import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import NewsListSkeleton from '../../components/skeletons/NewsListSkeleton'

type SearchNewsItem = {
  id: string
  title: string
  summary?: string
  url: string
  image?: string
  date: string
  source: string
  fetchedAt?: number | string
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const [inputValue, setInputValue] = React.useState(q)
  const [results, setResults] = React.useState<SearchNewsItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setInputValue(q)
  }, [q])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = inputValue.trim()
    const nextParams = new URLSearchParams(params)
    if (trimmed) {
      nextParams.set('q', trimmed)
    } else {
      nextParams.delete('q')
    }
    setParams(nextParams)
  }

  const loadResults = React.useCallback(async (keyword: string) => {
    const trimmed = keyword.trim()
    setError(null)

    if (!trimmed) {
      setResults([])
      setLoading(false)
      return
    }

    const base = import.meta.env.VITE_SUPABASE_URL
    if (!base) {
      setError('뉴스 프록시 설정이 필요합니다.')
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const url = new URL(`${base}/functions/v1/news-proxy`)
      url.searchParams.set('topic', 'all')
      url.searchParams.set('q', trimmed)
      url.searchParams.set('limit', '24')
      url.searchParams.set('page', '1')

      const headers: Record<string, string> = {}
      const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (anon) {
        headers['apikey'] = anon
        headers['Authorization'] = `Bearer ${anon}`
      }

      const res = await fetch(url.toString(), { headers })
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText)
        throw new Error(text || '검색 API 요청에 실패했습니다.')
      }

      const data = await res.json().catch(() => null)
      const items = Array.isArray(data?.items) ? data.items : []
      setResults(items)
    } catch (err: any) {
      setError(err?.message || '검색 결과를 불러오는 데 실패했습니다.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadResults(q)
  }, [q, loadResults])

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">검색</h2>
          <p className="text-muted-foreground text-sm">키워드로 뉴스/속보 검색</p>
        </div>

        {/* ✅ 여기부터 검색 + 필터 가로 정렬 구조 */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <form
            onSubmit={handleSubmit}
            className="flex flex-1 items-center gap-2"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="검색어를 입력하세요"
              className="flex-1 rounded-md border border-border bg-[#0b0f15] px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button
              size="sm"
              type="submit"
              variant="primary"
              className="shrink-0 whitespace-nowrap"
            >
              검색
            </Button>
          </form>

          <Button
            variant="secondary"
            className="shrink-0 whitespace-nowrap"
          >
            필터
          </Button>
        </div>
        {/* ✅ 여기까지 */}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>검색어</CardTitle>
          <CardDescription>
            {q ? `"${q}" 결과 ${results.length}건` : '검색어가 없습니다'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-3 rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          {!q ? (
            <p className="text-sm text-muted-foreground">검색어를 입력하면 결과가 표시됩니다.</p>
          ) : loading ? (
            <NewsListSkeleton items={6} />
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {results.map((item) => (
                <SearchResultCard key={item.id || item.url} item={item} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

const formatKSTDate = (input?: string | number | null) => {
  if (input == null) return ''
  const date = typeof input === 'number' ? new Date(input) : new Date(input)
  if (!date || Number.isNaN(date.getTime())) return String(input)

  const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value || ''
  return `${get('year')}.${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`
}

const SearchResultCard = React.memo(function SearchResultCard({ item }: { item: SearchNewsItem }) {
  const hasImage = typeof item.image === 'string' && !!item.image.trim()
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="flex w-full max-w-4xl gap-3 rounded-2xl border border-white/10 bg-[#0b111b] p-3 text-white transition hover:border-white/30 sm:p-4"
    >
      {hasImage && (
        <div className="flex-shrink-0 w-24">
          <div className="aspect-[16/9] overflow-hidden rounded-xl bg-slate-800">
            <img src={item.image!} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <h3 className="text-sm font-semibold leading-snug line-clamp-2 text-white sm:text-base">
          {item.title}
        </h3>
        {item.summary && (
          <p className="mt-2 text-[12px] leading-snug text-neutral-300 line-clamp-2 sm:text-[13px]">
            {item.summary}
          </p>
        )}
        <div className="mt-auto flex items-center gap-2 text-[11px] uppercase tracking-wider text-neutral-500 sm:text-[12px]">
          <span>{item.source}</span>
          <span>·</span>
          <time dateTime={item.date}>{formatKSTDate(item.fetchedAt ?? item.date)}</time>
        </div>
      </div>
    </a>
  )
})
