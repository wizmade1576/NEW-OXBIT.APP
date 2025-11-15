import { NavLink, Outlet } from 'react-router-dom'

export default function NewsLayout() {
  const tabs = [
    { to: '/news', label: '전체', index: true },
    { to: '/news/crypto', label: '암호화폐' },
    { to: '/news/global', label: '해외증시' },
    { to: '/news/fx', label: '환율/금리' },
  ]
  return (
    <div className="w-full mx-auto px-2 sm:px-3 md:px-4 max-w-full sm:max-w-[640px] md:max-w-[760px] lg:max-w-[900px]">
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">뉴스룸</h2>

      <div className="border-b border-border">
        <nav className="mx-auto flex max-w-3xl items-center justify-center gap-6">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.index}
              className={({ isActive }) =>
                'px-3 pb-3 text-sm border-b-2 transition-colors ' +
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
    </div>
  )
}
