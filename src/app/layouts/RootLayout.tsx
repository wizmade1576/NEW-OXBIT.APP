import * as React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Header from '../../components/navigation/Header'
import MobileBottomNav from '../../components/navigation/MobileBottomNav'
import getSupabase from '../../lib/supabase/client'
import { useAuthStore } from '@/store/useAuthStore'

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const ANALYTICS_SECRET = import.meta.env.VITE_ANALYTICS_INGEST_SECRET

export default function RootLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
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

  // Track page view to Supabase Edge Function (analytics-track)
  React.useEffect(() => {
    const base = import.meta.env.VITE_SUPABASE_URL
    if (!base) return
    const endpoint = `${base}/functions/v1/analytics-track`
    const payload = {
      path: location.pathname + location.search,
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    }
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(SUPABASE_ANON_KEY
          ? { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
          : {}),
        ...(ANALYTICS_SECRET ? { 'x-analytics-secret': ANALYTICS_SECRET } : {}),
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {})
  }, [location.pathname, location.search])

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 pb-24 sm:pb-6">
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  )
}
