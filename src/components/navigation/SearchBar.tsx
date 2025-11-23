import * as React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function SearchBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [q, setQ] = React.useState('')

  React.useEffect(() => {
    // 검색 페이지에서 쿼리 반영 (선택)
    if (location.pathname === '/search') {
      const params = new URLSearchParams(location.search)
      setQ(params.get('q') ?? '')
    }
  }, [location.pathname, location.search])

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const query = q.trim()
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search')
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-4">
      <form onSubmit={onSubmit} className="relative">
        <div className="flex items-center rounded-full border border-blue-600/60 bg-background px-4 py-2 shadow-[0_0_0_1px_rgba(37,99,235,0.2)_inset] focus-within:ring-2 focus-within:ring-blue-500">
          <input
            type="search"
            placeholder="검색어를 입력하세요"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-10 w-full rounded-full bg-transparent px-2 text-center text-base placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="submit"
            aria-label="검색"
            className="ml-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            🔍
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-muted-foreground">인기 코인</span>
          {['XRP', 'SOL', 'ETH', 'BTC'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setQ((prev) => (prev ? `${prev} ${t}` : t))}
              className="rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:bg-accent"
            >
              #{t}
            </button>
          ))}
        </div>
      </form>
    </div>
  )
}
