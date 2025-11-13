import { NavLink } from 'react-router-dom'
import ThemeToggle from '../ui/ThemeToggle'
import * as React from 'react'
import getSupabase from '../../lib/supabase/client'

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden {...props}>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

const BRAND = 'OXBIT.APP' as const

export default function Header() {
  const [moreOpen, setMoreOpen] = React.useState(false)
  const moreRef = React.useRef<HTMLDivElement | null>(null)

  const [userEmail, setUserEmail] = React.useState<string | null>(null)
  const [isAdmin, setIsAdmin] = React.useState(false)

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!moreOpen) return
      const t = e.target as Node
      if (moreRef.current && !moreRef.current.contains(t)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [moreOpen])

  React.useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return
    let mounted = true
    const load = async () => {
      const { data } = await supabase.auth.getSession()
      const email = data.session?.user?.email || null
      if (!mounted) return
      setUserEmail(email)
      if (email) {
        const uid = data.session?.user?.id
        if (uid) {
          const { data: prof } = await supabase.from('profiles').select('role').eq('id', uid).single()
          if (mounted) setIsAdmin((prof?.role || 'user') === 'admin')
        }
      } else {
        setIsAdmin(false)
      }
    }
    load()
    const { data: sub } = supabase.auth.onAuthStateChange(() => load())
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  async function logout() {
    const supabase = getSupabase(); if (!supabase) return
    await supabase.auth.signOut()
    setUserEmail(null)
    setIsAdmin(false)
  }

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-6">
        <div className="font-semibold tracking-tight">{BRAND}</div>
        <nav className="flex items-center gap-4 text-sm overflow-x-hidden sm:overflow-visible">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>홈</NavLink>
          <NavLink to="/breaking" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>속보</NavLink>
          <NavLink to="/news" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>뉴스</NavLink>
          <NavLink to="/markets" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>마켓</NavLink>
          <NavLink to="/positions" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>실시간포지션</NavLink>
          <NavLink to="/community" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>커뮤니티</NavLink>
          <NavLink to="/paper" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>모의투자</NavLink>
          <NavLink to="/ads" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>광고</NavLink>
          <div ref={moreRef} className="relative">
            <button type="button" aria-haspopup="menu" aria-expanded={moreOpen} className="text-muted-foreground hover:text-foreground" onClick={() => setMoreOpen(v=>!v)}>더보기 ▾</button>
            <div className={(moreOpen ? 'block ' : 'hidden ') + 'absolute left-0 top-full w-56 rounded-md border border-border bg-popover p-2 shadow-lg'}>
              <NavLink to="/more/notices" onClick={() => setMoreOpen(false)} className={({ isActive }) => (isActive ? 'flex items-center gap-3 rounded px-3 py-2 text-primary' : 'flex items-center gap-3 rounded px-3 py-2 text-foreground hover:bg-accent')}>
                <span>📢</span>
                <span className="whitespace-nowrap">공지사항</span>
              </NavLink>
              <NavLink to="/more/guide" onClick={() => setMoreOpen(false)} className={({ isActive }) => (isActive ? 'flex items-center gap-3 rounded px-3 py-2 text-primary' : 'flex items-center gap-3 rounded px-3 py-2 text-foreground hover:bg-accent')}>
                <span>📖</span>
                <span className="whitespace-nowrap">이용 가이드</span>
              </NavLink>
              {isAdmin ? (
                <NavLink to="/admin" onClick={() => setMoreOpen(false)} className={({ isActive }) => (isActive ? 'flex items-center gap-3 rounded px-3 py-2 text-primary' : 'flex items-center gap-3 rounded px-3 py-2 text-foreground hover:bg-accent')}>
                  <span>🛠️</span>
                  <span className="whitespace-nowrap">관리자</span>
                </NavLink>
              ) : null}
            </div>
          </div>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <NavLink to="/search" aria-label="검색" title="검색" className={({ isActive }) => (isActive ? 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-accent text-foreground' : 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-accent')}>
            <SearchIcon />
          </NavLink>
          <ThemeToggle />
          {userEmail ? (
            <div className="relative group">
              <button className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground hover:bg-accent">{userEmail}</button>
              <div className="absolute right-0 mt-1 hidden group-hover:block rounded-md border border-border bg-popover p-2 shadow-lg">
                <NavLink to="/profile" className={({isActive})=> isActive ? 'block rounded px-3 py-1.5 text-primary' : 'block rounded px-3 py-1.5 hover:bg-accent'}>내 정보</NavLink>
                {isAdmin ? <NavLink to="/admin" className={({isActive})=> isActive ? 'block rounded px-3 py-1.5 text-primary' : 'block rounded px-3 py-1.5 hover:bg-accent'}>관리자</NavLink> : null}
                <button onClick={logout} className="block w-full text-left rounded px-3 py-1.5 hover:bg-accent">로그아웃</button>
              </div>
            </div>
          ) : (
            <NavLink to="/login" className={({ isActive }) => (isActive ? 'inline-flex h-9 items-center justify-center rounded-md border border-input bg-accent px-3 text-sm font-medium text-foreground' : 'inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground hover:bg-accent')}>
              로그인
            </NavLink>
          )}
        </div>
      </div>
    </header>
  )
}

