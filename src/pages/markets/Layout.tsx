import { NavLink, Outlet } from 'react-router-dom'

export default function MarketsLayout() {
  const tabs = [
    { to: '/markets/stocks', label: '스톡' },
    { to: '/markets/crypto', label: '암호화폐' },
    { to: '/markets/futures', label: '선물' },
    { to: '/markets/kimchi', label: '김프' },
    { to: '/markets/schedule', label: '일정' },
  ]
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">마켓</h2>

      <div className="border-b border-border">
        <nav className="mx-auto flex max-w-3xl items-center gap-4 sm:justify-center whitespace-nowrap overflow-x-auto scrollbar-hide">
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
