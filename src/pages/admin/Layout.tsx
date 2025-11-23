import * as React from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/admin', label: '대시보드', end: true },
  { to: '/admin/analytics', label: '방문자 애널리틱스' },
  { to: '/admin/users', label: '회원관리' },
  { to: '/admin/positions', label: '실시간 포지션' },
  { to: '/admin/breaking', label: '속보' },
  { to: '/admin/ads', label: '광고' },
]

export default function AdminLayout() {
  const [open, setOpen] = React.useState(false)
  const nav = (
    <nav className="flex flex-col gap-2 text-sm">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) => (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
  return (
    <section className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
      <div className="md:hidden sticky top-0 z-40 bg-card/80 backdrop-blur">
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="w-full rounded-lg border border-border bg-[#0f0f15] px-4 py-3 text-sm font-semibold text-white text-left"
        >
          관리자
        </button>
        {open && (
          <div className="rounded-lg border border-border bg-card p-4 mt-2 shadow-xl">
            {nav}
          </div>
        )}
      </div>
      <aside className="hidden md:block rounded-lg border border-border bg-card p-4 h-fit sticky top-16">
        <h3 className="mb-3 text-sm font-semibold">관리자</h3>
        {nav}
      </aside>
      <main>
        <Outlet />
      </main>
    </section>
  )
}
