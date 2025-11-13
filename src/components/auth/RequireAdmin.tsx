import * as React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import getSupabase from '../../lib/supabase/client'

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const loc = useLocation()
  const [loading, setLoading] = React.useState(true)
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false)

  React.useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) { setLoading(false); setIsAdmin(false); return }
    let mounted = true
    const run = async () => {
      const { data: session } = await supabase.auth.getSession()
      const uid = session.session?.user?.id
      if (!uid) { setLoading(false); setIsAdmin(false); return }
      const { data } = await supabase.from('profiles').select('role').eq('id', uid).single()
      if (!mounted) return
      setIsAdmin((data?.role || 'user') === 'admin')
      setLoading(false)
    }
    run()
    return () => { mounted = false }
  }, [])

  if (loading) return <div className="p-6 text-sm text-muted-foreground">관리자 권한 확인 중...</div>
  if (!isAdmin) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />
  return <>{children}</>
}

