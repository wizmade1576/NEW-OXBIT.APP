import * as React from 'react'
import { NavLink, useLocation } from 'react-router-dom'

// Bold inline SVG icons
function BoltIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M13 2L3 14h6l-2 8 10-12h-6z" />
    </svg>
  )
}
function NewspaperIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M3 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4z" />
      <path d="M7 8h8" />
      <path d="M7 12h8" />
      <path d="M7 16h6" />
    </svg>
  )
}
function CandlesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M7 3v4" />
      <rect x="5" y="7" width="4" height="8" rx="1" />
      <path d="M7 15v6" />
      <path d="M17 1v6" />
      <rect x="15" y="7" width="4" height="6" rx="1" />
      <path d="M17 13v8" />
    </svg>
  )
}
function TargetIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M2 12h3M22 12h-3M12 22v-3" />
    </svg>
  )
}
function ChatIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      <path d="M8 8h8M8 12h5" />
    </svg>
  )
}
function BeakerIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M6 2h12" />
      <path d="M9 2v4l-5 8a4 4 0 0 0 3.4 6h9.2A4 4 0 0 0 20 14l-5-8V2" />
      <path d="M8 11h8" />
    </svg>
  )
}

type Item = {
  to: string
  label: string
  icon: React.ReactNode
}

const items: Item[] = [
  { to: '/paper', label: '모의투자', icon: <BeakerIcon /> },
  { to: '/breaking', label: '속보', icon: <BoltIcon /> },
  { to: '/news', label: '뉴스', icon: <NewspaperIcon /> },
  { to: '/markets', label: '마켓', icon: <CandlesIcon /> },
  { to: '/positions', label: '포지션', icon: <TargetIcon /> },
]

export default function MobileBottomNav() {
  const { pathname } = useLocation()
  return (
    <nav
      className="sm:hidden fixed inset-x-0 bottom-0 z-50 border-t border-neutral-800 bg-[#101214] backdrop-blur supports-[backdrop-filter]:bg-[#101214]/85"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5 h-14">
        {items.map((it) => {
          const active = pathname === it.to || pathname.startsWith(it.to + '/')
          return (
            <li key={it.to} className="flex items-stretch">
              <NavLink
                to={it.to}
                className={
                  'flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ' +
                  (active ? 'text-emerald-400' : 'text-neutral-400 hover:text-neutral-200')
                }
              >
                <div className={(active ? 'bg-emerald-500/10 text-emerald-400 ' : '') + 'flex h-9 w-9 items-center justify-center rounded-md'}>
                  <span className={(active ? 'scale-110 ' : '') + 'transition-transform'}>{it.icon}</span>
                </div>
                <span className={active ? 'font-medium' : ''}>{it.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
