import { NavLink, Outlet } from 'react-router-dom'

export default function PositionsLayout() {
  const tabs = [
    { to: '/positions/live', label: '실시간포지션' },
    { to: '/positions/long-short', label: '롱&숏' },
    { to: '/positions/whales', label: '고래추적' },
    { to: '/positions/fear-greed', label: '공포/탐욕' },
  ]
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">포지션</h2>

      <div className="border-b border-border">
        <nav className="mx-auto flex max-w-3xl items-center gap-4 whitespace-nowrap overflow-x-auto scrollbar-hide justify-center sm:justify-center">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                'flex-none px-3 pb-3 text-[13px] sm:text-base transition-colors border-b-2 ' +
                (isActive
                  ? 'border-blue-500 text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground')
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />
    </section>
  )
}
