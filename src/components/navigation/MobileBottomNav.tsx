import * as React from 'react'
import { NavLink, useLocation } from 'react-router-dom'

type Item = {
  to: string
  label: string
  icon: React.ReactNode
}

const items: Item[] = [
  { to: '/paper', label: '모의투자', icon: <span className="text-lg">📊</span> },
  { to: '/breaking', label: '속보', icon: <span className="text-lg">🕒</span> },
  { to: '/news', label: '뉴스', icon: <span className="text-lg">📰</span> },
  { to: '/markets', label: '마켓', icon: <span className="text-lg">📈</span> },
  { to: '/positions', label: '포지션', icon: <span className="text-lg">📡</span> },
  { to: '/community', label: '커뮤니티', icon: <span className="text-lg">👥</span> },
]

export default function MobileBottomNav() {
  const { pathname } = useLocation()
  // Hide on wide screens
  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-[#101214] backdrop-blur supports-[backdrop-filter]:bg-[#101214]/85"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-6 h-14">
        {items.map((it) => {
          const active = pathname === it.to || pathname.startsWith(it.to + '/')
          return (
            <li key={it.to} className="flex items-stretch">
              <NavLink
                to={it.to}
                className={
                  'flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] ' +
                  (active ? 'text-emerald-400' : 'text-neutral-400 hover:text-neutral-200')
                }
              >
                {it.icon}
                <span>{it.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
