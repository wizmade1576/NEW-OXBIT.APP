import * as React from 'react'
import { createPortal } from 'react-dom'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Header from '../../components/navigation/Header'
import MobileBottomNav from '../../components/navigation/MobileBottomNav'
import getSupabase from '../../lib/supabase/client'
import { useAuthStore } from '@/store/useAuthStore'

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const ANALYTICS_SECRET = import.meta.env.VITE_ANALYTICS_INGEST_SECRET

type ChatMessage = {
  id: string
  user: string
  badge?: string
  text: string
  time: string
}

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

  const [openChat, setOpenChat] = React.useState(false)
  const [chatInput, setChatInput] = React.useState('')
  const chatMessages = React.useMemo(
    () => [
      { id: 'm1', user: '준배87', badge: 'TOS', text: '없는데', time: '07:30' },
      { id: 'm2', user: '공포에 살아야지', text: '공포에 샀어야지', time: '07:30' },
      { id: 'm3', user: '익절', text: '너무 빠른 익절이었나 ㅇㅅㅇ?', time: '07:31' },
      { id: 'm4', user: '바운스 토론', text: '심상치 않다', time: '07:31' },
      { id: 'm5', user: '자야겠다', text: '자야겠다 ㅅㅂ ㅋㅋ', time: '07:32' },
      { id: 'm6', user: '에이더', text: '에이더 떡상을 기원하면서...', time: '07:32' },
    ],
    []
  )

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 pb-24 sm:pb-6">
        <Outlet />
      </main>
      <button
        type="button"
        onClick={() => setOpenChat((v) => !v)}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 h-14 w-14 rounded-full bg-blue-500 shadow-lg shadow-blue-500/30 text-[13px] font-bold text-white hover:bg-blue-400 transition-colors"
        aria-label="CHAT 열기"
      >
        CHAT
      </button>
      {openChat
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-end justify-center sm:justify-end sm:items-end pointer-events-none">
              <div
                className="absolute inset-0 bg-black/50 sm:hidden pointer-events-auto"
                onClick={() => setOpenChat(false)}
              />
              <div
                className="relative pointer-events-auto w-full sm:w-[380px] max-w-full sm:max-w-[380px] bg-[#0f0f0f] border border-neutral-800 sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[80vh] sm:mr-4 sm:mb-20 flex flex-col"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-[#0b0b0b] rounded-t-2xl sm:rounded-t-2xl sticky top-0">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-blue-500 px-3 py-1 text-xs font-bold text-white">CHAT</div>
                    <button className="text-sm font-semibold text-blue-400 inline-flex items-center gap-1">
                      기본 채널 <span>▼</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-400">
                    <button title="새로고침" className="hover:text-white">⟳</button>
                    <button title="삭제" className="hover:text-white">🗑</button>
                    <button title="설정" className="hover:text-white">⚙</button>
                    <button title="닫기" className="hover:text-white" onClick={() => setOpenChat(false)}>✕</button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                  {chatMessages.map((m) => (
                    <div key={m.id} className="space-y-0.5">
                      <div className="flex items-center gap-2 text-xs text-neutral-400">
                        <span className="font-semibold text-white">{m.user}</span>
                        {m.badge ? (
                          <span className="rounded-full bg-neutral-700 px-1.5 py-[1px] text-[11px] text-neutral-200">
                            {m.badge}
                          </span>
                        ) : null}
                        <span className="text-neutral-500">{m.time}</span>
                      </div>
                      <div className="text-sm leading-snug text-neutral-200">{m.text}</div>
                    </div>
                  ))}
                  {chatMessages.length === 0 ? (
                    <div className="text-sm text-neutral-500">메시지가 없습니다.</div>
                  ) : null}
                </div>
                <div className="border-t border-neutral-800 bg-[#0b0b0b] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="메시지를 입력하세요"
                      className="flex-1 rounded-md bg-[#1b1b1b] border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      className="rounded-md bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-400"
                    >
                      전송
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
      <MobileBottomNav />
    </div>
  )
}
