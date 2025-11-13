import { NavLink, Outlet } from 'react-router-dom'

export default function CommunityLayout() {
  const tabs = [
    { to: '/community/lounge', label: '라운지' },
    { to: '/community/experts', label: '전문가' },
  ]
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">커뮤니티</h2>

      <div className="border-b border-border">
        <nav className="mx-auto flex max-w-3xl items-center justify-center gap-6">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
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
  )
}

