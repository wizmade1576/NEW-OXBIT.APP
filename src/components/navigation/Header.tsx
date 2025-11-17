import { NavLink } from 'react-router-dom'
import ThemeToggle from '../ui/ThemeToggle'
import * as React from 'react'
import getSupabase from '../../lib/supabase/client'
import { useAuthStore } from '@/store/useAuthStore'

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden {...props}>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

const BRAND = 'OXBIT.APP' as const

function HamburgerIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  )
}

export default function Header() {
  const [moreOpen, setMoreOpen] = React.useState(false)
  const moreRef = React.useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement | null>(null)

  const user = useAuthStore((s) => s.user)
  const [isAdmin, setIsAdmin] = React.useState(false)

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (moreOpen && moreRef.current && !moreRef.current.contains(t)) setMoreOpen(false)
      if (menuOpen && menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [moreOpen, menuOpen])

  React.useEffect(() => {
    let mounted = true
    async function check() {
      const sb = getSupabase()
      if (!sb) return
      if (user?.id) {
        const { data: prof } = await sb.from('profiles').select('role').eq('id', user.id).single()
        if (mounted) setIsAdmin((prof?.role || 'user') === 'admin')
      } else {
        if (mounted) setIsAdmin(false)
      }
    }
    check()
    return () => { mounted = false }
  }, [user])

  async function logout() {
    const supabase = getSupabase(); if (!supabase) return
    await supabase.auth.signOut()
    useAuthStore.getState().logout()
    setIsAdmin(false)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-6">
        {/* Mobile: brand navigates to Breaking page; Desktop: unchanged text */}
        <NavLink to="/breaking" className="font-semibold tracking-tight md:hidden" aria-label="OXBIT.APP">
          {BRAND}
        </NavLink>
        <div className="font-semibold tracking-tight hidden md:block">{BRAND}</div>
        <nav className="hidden md:flex items-center gap-4 text-sm overflow-x-hidden sm:overflow-visible">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>홈</NavLink>
          <NavLink to="/breaking" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>속보</NavLink>
          <NavLink to="/news" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>뉴스</NavLink>
          <NavLink to="/markets" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>마켓</NavLink>
          <NavLink to="/positions" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>포지션</NavLink>
          <NavLink to="/community" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>커뮤니티</NavLink>
          <NavLink to="/paper" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>모의투자</NavLink>
          <NavLink to="/ads" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>광고</NavLink>
          <div ref={moreRef} className="relative">
            <button type="button" aria-haspopup="menu" aria-expanded={moreOpen} className="text-muted-foreground hover:text-foreground" onClick={() => setMoreOpen(v=>!v)}>더보기</button>
            <div className={(moreOpen ? 'block ' : 'hidden ') + 'absolute left-0 top-full w-56 rounded-md border border-border bg-popover p-2 shadow-lg'}>
              <NavLink to="/more/notices" onClick={() => setMoreOpen(false)} className={({ isActive }) => (isActive ? 'flex items-center gap-3 rounded px-3 py-2 text-primary' : 'flex items-center gap-3 rounded px-3 py-2 text-foreground hover:bg-accent')}>
                <span>•</span>
                <span className="whitespace-nowrap">공지사항</span>
              </NavLink>
              <NavLink to="/more/guide" onClick={() => setMoreOpen(false)} className={({ isActive }) => (isActive ? 'flex items-center gap-3 rounded px-3 py-2 text-primary' : 'flex items-center gap-3 rounded px-3 py-2 text-foreground hover:bg-accent')}>
                <span>•</span>
                <span className="whitespace-nowrap">이용 가이드</span>
              </NavLink>
              {isAdmin ? (
                <NavLink to="/admin" onClick={() => setMoreOpen(false)} className={({ isActive }) => (isActive ? 'flex items-center gap-3 rounded px-3 py-2 text-primary' : 'flex items-center gap-3 rounded px-3 py-2 text-foreground hover:bg-accent')}>
                  <span>•</span>
                  <span className="whitespace-nowrap">관리자</span>
                </NavLink>
              ) : null}
            </div>
          </div>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {/* Desktop controls */}
          <div className="hidden md:flex items-center gap-2">
            <NavLink to="/search" aria-label="검색" title="검색" className={({ isActive }) => (isActive ? 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-accent text-foreground' : 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-accent')}>
              <SearchIcon />
            </NavLink>
            <ThemeToggle />
            {user?.email ? (
              <div className="relative group">
                <button className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground hover:bg-accent">{user.email}</button>
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
          {/* Mobile quick icons */}
          <div className="flex md:hidden items-center gap-2">
            <NavLink to="/search" aria-label="검색" title="검색" className={({ isActive }) => (isActive ? 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-accent text-foreground' : 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-accent')}>
              <SearchIcon />
            </NavLink>
            <ThemeToggle />
          </div>

          {/* Mobile hamburger */}
          <button type="button" className="inline-flex md:hidden h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-accent" aria-label="메뉴" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>
            <HamburgerIcon />
          </button>
          {/* Mobile menu panel */}
          <div ref={menuRef} className={(menuOpen ? 'block ' : 'hidden ') + 'md:hidden absolute right-4 top-14 w-64 rounded-md border border-border bg-popover p-2 shadow-lg z-50'}>
            <div className="px-2 py-1.5 text-xs text-muted-foreground">탐색</div>
            <NavLink to="/paper" onClick={() => setMenuOpen(false)} className={({ isActive }) => (isActive ? 'block rounded px-3 py-2 text-primary' : 'block rounded px-3 py-2 hover:bg-accent')}>모의투자</NavLink>
            <NavLink to="/breaking" onClick={() => setMenuOpen(false)} className={({ isActive }) => (isActive ? 'block rounded px-3 py-2 text-primary' : 'block rounded px-3 py-2 hover:bg-accent')}>속보</NavLink>
            <NavLink to="/news" onClick={() => setMenuOpen(false)} className={({ isActive }) => (isActive ? 'block rounded px-3 py-2 text-primary' : 'block rounded px-3 py-2 hover:bg-accent')}>뉴스</NavLink>
            <NavLink to="/markets" onClick={() => setMenuOpen(false)} className={({ isActive }) => (isActive ? 'block rounded px-3 py-2 text-primary' : 'block rounded px-3 py-2 hover:bg-accent')}>마켓</NavLink>
            <NavLink to="/positions" onClick={() => setMenuOpen(false)} className={({ isActive }) => (isActive ? 'block rounded px-3 py-2 text-primary' : 'block rounded px-3 py-2 hover:bg-accent')}>포지션</NavLink>
            <NavLink to="/community" onClick={() => setMenuOpen(false)} className={({ isActive }) => (isActive ? 'block rounded px-3 py-2 text-primary' : 'block rounded px-3 py-2 hover:bg-accent')}>커뮤니티</NavLink>
            <div className="my-1 h-px bg-border" />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">계정</div>
            {user?.email ? (
              <>
                <div className="px-3 py-2 text-sm text-muted-foreground truncate">{user.email}</div>
                <NavLink to="/profile" onClick={() => setMenuOpen(false)} className={({isActive})=> isActive ? 'block rounded px-3 py-2 text-primary' : 'block rounded px-3 py-2 hover:bg-accent'}>내 정보</NavLink>
                {isAdmin ? <NavLink to="/admin" onClick={() => setMenuOpen(false)} className={({isActive})=> isActive ? 'block rounded px-3 py-2 text-primary' : 'block rounded px-3 py-2 hover:bg-accent'}>관리자</NavLink> : null}
                <button onClick={() => { setMenuOpen(false); logout() }} className="block w-full text-left rounded px-3 py-2 hover:bg-accent">로그아웃</button>
              </>
            ) : (
              <NavLink to="/login" onClick={() => setMenuOpen(false)} className={({ isActive }) => (isActive ? 'block rounded px-3 py-2 text-primary' : 'block rounded px-3 py-2 hover:bg-accent')}>
                로그인
              </NavLink>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
