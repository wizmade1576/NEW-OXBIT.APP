import * as React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import getSupabase from '../../lib/supabase/client'
import { useAuthStore } from '@/store/useAuthStore'

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const loc = useLocation()
  const user = useAuthStore((s) => s.user)
  const [loading, setLoading] = React.useState(true)
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false)

  React.useEffect(() => {
    if (!user) { setLoading(false); setIsAdmin(false); return }
    const supabase = getSupabase()
    if (!supabase) { setLoading(false); setIsAdmin(false); return }
    let mounted = true
    const run = async () => {
      const uid = user.id
      const { data } = await supabase.from('profiles').select('role').eq('id', uid).single()
      if (!mounted) return
      setIsAdmin((data?.role || 'user') === 'admin')
      setLoading(false)
    }
    run()
    return () => { mounted = false }
  }, [user])

  if (loading) return <div className="p-6 text-sm text-muted-foreground">관리자 권한 확인 중…</div>
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />
  if (!isAdmin) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />
  return <>{children}</>
}

