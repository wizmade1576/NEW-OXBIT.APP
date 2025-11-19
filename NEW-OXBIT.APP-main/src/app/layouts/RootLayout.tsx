import * as React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Header from '../../components/navigation/Header'
import MobileBottomNav from '../../components/navigation/MobileBottomNav'
import SearchBar from '../../components/navigation/SearchBar'
import TickerBar from '../../components/navigation/TickerBar'
import getSupabase from '../../lib/supabase/client'
import { useAuthStore } from '@/store/useAuthStore'

export default function RootLayout() {
  const location = useLocation()
  const navigate = useNavigate()
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

  // Mobile-only: start at Breaking page when landing on '/'
  React.useEffect(() => {
    try {
      const isMobile = window.matchMedia && window.matchMedia('(max-width: 639px)').matches
      if (isMobile && location.pathname === '/') {
        navigate('/breaking', { replace: true })
      }
    } catch {}
  }, [location.pathname, navigate])

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <Header />
      {showSearchBar && (
        <>
          <SearchBar />
          <div className="mt-4 sm:mt-6 md:mt-8">
            <TickerBar />
          </div>
        </>
      )}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 pb-24 sm:pb-6">
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  )
}
