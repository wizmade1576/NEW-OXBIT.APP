import * as React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from '../../components/navigation/Header'
import SearchBar from '../../components/navigation/SearchBar'
import TickerBar from '../../components/navigation/TickerBar'
import getSupabase from '../../lib/supabase/client'
import { useAuthStore } from '@/store/useAuthStore'
import { fetchCrypto, fetchStocks, fetchFx } from '../../lib/news/providers'
import { fetchAllTopics } from '../../lib/news/aggregate'

export default function RootLayout() {
  const location = useLocation()
  const setUser = useAuthStore((s) => s.setUser)
  const showSearchBar = location.pathname === '/'
  // Hydrate auth store from Supabase session and listen to changes
  React.useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setUser(data.session?.user ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => { mounted = false; sub?.subscription?.unsubscribe?.() }
  }, [setUser])

  // Warm NEWS caches in the background so tabs show immediately without loaders
  React.useEffect(() => {
    const TTL = 1000 * 60 * 10 // 10 minutes
    const shouldRefresh = (key: string) => {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) return true
        const c = JSON.parse(raw)
        const age = Date.now() - Number(c.ts || 0)
        if (!Array.isArray(c.items) || c.items.length === 0) return true
        return age > TTL
      } catch { return true }
    }
    ;(async () => {
      try {
        if (shouldRefresh('news:crypto:v2')) {
          const res = await fetchCrypto(undefined, 10)
          try { localStorage.setItem('news:crypto:v2', JSON.stringify({ items: res.items, cursor: res.cursor, page: 1, hasMore: true, ts: Date.now() })) } catch {}
        }
      } catch {}
      try {
        if (shouldRefresh('news:global:v2')) {
          const res = await fetchStocks(undefined, 10)
          try { localStorage.setItem('news:global:v2', JSON.stringify({ items: res.items, cursor: res.cursor, page: 1, hasMore: true, ts: Date.now() })) } catch {}
        }
      } catch {}
      try {
        if (shouldRefresh('news:fx:v2')) {
          const res = await fetchFx(undefined, 10)
          try { localStorage.setItem('news:fx:v2', JSON.stringify({ items: res.items, cursor: res.cursor, page: 1, hasMore: true, ts: Date.now() })) } catch {}
        }
      } catch {}
      try {
        if (shouldRefresh('news:all:v2')) {
          const res = await fetchAllTopics({ limitPerTopic: 5 })
          try { localStorage.setItem('news:all:v2', JSON.stringify({ items: res.items, cursor: res.cursor, page: res.page, hasMore: true, ts: Date.now() })) } catch {}
        }
      } catch {}
    })()
  }, [])
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      {showSearchBar && (
        <>
          <SearchBar />
          <div className="mt-4 sm:mt-6 md:mt-8">
            <TickerBar />
          </div>
        </>
      )}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  )
}
