import { NavLink } from 'react-router-dom'
import ThemeToggle from '../ui/ThemeToggle'
import * as React from 'react'
import getSupabase from '../../lib/supabase/client'
import { useAuthStore } from '@/store/useAuthStore'
import GlobalChatDrawer from '../chat/GlobalChatDrawer'

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
  const MORE_ENABLED = false
  const [moreOpen, setMoreOpen] = React.useState(false)
  const moreRef = React.useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement | null>(null)
  const [concurrentUsers, setConcurrentUsers] = React.useState(1654)
  const [chatOpen, setChatOpen] = React.useState(false)

  const user = useAuthStore((s) => s.user)
  const [isAdmin, setIsAdmin] = React.useState(false)

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (MORE_ENABLED && moreOpen && moreRef.current && !moreRef.current.contains(t)) setMoreOpen(false)
      if (menuOpen && menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen, moreOpen, MORE_ENABLED])

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
    return () => {
      mounted = false
    }
  }, [user])

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setConcurrentUsers((prev) => {
        const delta = Math.floor((Math.random() - 0.5) * 40)
        const next = prev + delta
        return Math.max(1200, Math.min(2800, next))
      })
    }, 3500)
    return () => window.clearInterval(id)
  }, [])

  async function logout() {
    const supabase = getSupabase()
    if (!supabase) return
    await supabase.auth.signOut()
    useAuthStore.getState().logout()
    setIsAdmin(false)
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-6">
        
        <NavLink to="/breaking" className="font-semibold tracking-tight" aria-label="OXBIT.APP">
          {BRAND}
        </NavLink>

        <nav className="hidden md:flex items-center gap-4 text-sm overflow-x-hidden sm:overflow-visible">
          <NavLink to="/breaking" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
            속보
          </NavLink>
          <NavLink to="/news" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
            뉴스
          </NavLink>
          <NavLink to="/markets" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
            마켓
          </NavLink>
          <NavLink to="/positions" className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
            포지션
          </NavLink>

          <button
            type="button"
            onClick={() => alert('해당 기능은 준비 중입니다. 추후 업데이트 예정입니다.')}
            className="text-muted-foreground hover:text-foreground"
          >
            모의투자
          </button>
        </nav>

        {/* 우측 컨트롤 */}
        <div className="ml-auto flex items-center gap-2">

          {/* 데스크탑 */}
          <div className="hidden md:flex items-center gap-2">
            <div className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap pr-2">
              <span className="font-medium text-foreground/80">동시접속자</span>
              <span className="font-semibold text-primary">{concurrentUsers.toLocaleString('ko-KR')}</span>
            </div>

            <NavLink
              to="/search"
              aria-label="검색"
              title="검색"
              className={({ isActive }) =>
                isActive
                  ? 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-accent text-foreground'
                  : 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-accent'
              }
            >
              <SearchIcon />
            </NavLink>

            <ThemeToggle />
            <button
              type="button"
              onClick={() => setChatOpen((prev) => !prev)}
              aria-label={chatOpen ? 'Close global chat' : 'Open global chat'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-accent"
            >
              💬
            </button>

            {user?.email ? (
              <div className="relative group">
                <button className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground hover:bg-accent">
                  {user.email}
                </button>

                <div className="absolute right-0 mt-1 hidden group-hover:block rounded-md border border-border bg-popover p-2 shadow-lg">
                  <NavLink
                    to="/profile"
                    className={({ isActive }) => (isActive ? 'block rounded px-3 py-1.5 text-primary' : 'block rounded px-3 py-1.5 hover:bg-accent')}
                  >
                    내 프로필
                  </NavLink>

                  {isAdmin ? (
                    <NavLink
                      to="/admin"
                      className={({ isActive }) => (isActive ? 'block rounded px-3 py-1.5 text-primary' : 'block rounded px-3 py-1.5 hover:bg-accent')}
                    >
                      관리자 페이지
                    </NavLink>
                  ) : null}

                  <button onClick={logout} className="block w-full text-left rounded px-3 py-1.5 hover:bg-accent">
                    로그아웃
                  </button>
                </div>
              </div>
            ) : (
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  isActive
                    ? 'inline-flex h-9 items-center justify-center rounded-md border border-input bg-accent px-3 text-sm font-medium text-foreground'
                    : 'inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground hover:bg-accent'
                }
              >
                로그인
              </NavLink>
            )}
          </div>

          {/* 모바일 quick 메뉴 */}
          <div className="flex md:hidden items-center gap-2">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1 whitespace-nowrap pr-1">
              <span className="font-medium text-foreground/80">동시접속</span>
              <span className="font-semibold text-primary">{concurrentUsers.toLocaleString('ko-KR')}</span>
            </div>

            <NavLink
              to="/search"
              aria-label="검색"
              title="검색"
              className={({ isActive }) =>
                isActive
                  ? 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-accent text-foreground'
                  : 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-accent'
              }
            >
              <SearchIcon />
            </NavLink>

            <button
              type="button"
              onClick={() => setChatOpen((prev) => !prev)}
              aria-label={chatOpen ? 'Close global chat' : 'Open global chat'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-accent"
            >
              💬
            </button>
          </div>

          {/* 모바일 햄버거 */}
          <button
            type="button"
            className="inline-flex md:hidden h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-accent"
            aria-label="메뉴"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <HamburgerIcon />
          </button>

          {/* 모바일 메뉴 패널 */}
          <div
            ref={menuRef}
            className={(menuOpen ? 'block ' : 'hidden ') + 'md:hidden absolute right-4 top-14 w-64 rounded-md border border-border bg-popover p-2 shadow-lg z-50'}
          >
            <div className="px-2 py-1.5 text-xs text-muted-foreground">메뉴</div>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                alert('해당 기능은 준비 중입니다. 추후 업데이트 예정입니다.')
              }}
              className="block rounded px-3 py-2 hover:bg-accent text-foreground"
            >
              공지사항
            </button>

            <NavLink
              to="/breaking"
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => (isActive ? 'block rounded px-3 py-2 text-primary' : 'block rounded px-3 py-2 hover:bg-accent')}
            >
              속보
            </NavLink>

            <NavLink
              to="/news"
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => (isActive ? 'block rounded px-3 py-2 text-primary' : 'block rounded px-3 py-2 hover:bg-accent')}
            >
              뉴스
            </NavLink>

            <NavLink
              to="/markets"
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => (isActive ? 'block rounded px-3 py-2 text-primary' : 'block rounded px-3 py-2 hover:bg-accent')}
            >
              마켓
            </NavLink>

            <NavLink
              to="/positions"
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => (isActive ? 'block rounded px-3 py-2 text-primary' : 'block rounded px-3 py-2 hover:bg-accent')}
            >
              포지션
            </NavLink>

            <div className="my-1 h-px bg-border" />

            <div className="px-2 py-1.5 text-xs text-muted-foreground">설정</div>
            <div className="flex items-center gap-2 px-3 py-2">
              <ThemeToggle />
            </div>

            <div className="px-2 py-1.5 text-xs text-muted-foreground">계정</div>

            {user?.email ? (
              <>
                <div className="px-3 py-2 text-sm text-muted-foreground truncate">{user.email}</div>

                <NavLink
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => (isActive ? 'block rounded px-3 py-2 text-primary' : 'block rounded px-3 py-2 hover:bg-accent')}
                >
                  내 프로필
                </NavLink>

                {isAdmin ? (
                  <NavLink
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) => (isActive ? 'block rounded px-3 py-2 text-primary' : 'block rounded px-3 py-2 hover:bg-accent')}
                  >
                    관리자 페이지
                  </NavLink>
                ) : null}

                <button
                  onClick={() => {
                    setMenuOpen(false)
                    logout()
                  }}
                  className="block w-full text-left rounded px-3 py-2 hover:bg-accent"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <NavLink
                to="/login"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => (isActive ? 'block rounded px-3 py-2 text-primary' : 'block rounded px-3 py-2 hover:bg-accent')}
              >
                로그인
              </NavLink>
            )}
          </div>
        </div>
      </div>
    </header>
    <GlobalChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
  </>
  )
}
