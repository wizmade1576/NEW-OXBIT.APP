// React import not needed with react-jsx
import { NavLink, Outlet } from 'react-router-dom'

export default function AdminLayout() {
  return (
    <section className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
      <aside className="rounded-lg border border-border bg-card p-4 h-fit sticky top-16">
        <h3 className="mb-3 text-sm font-semibold">관리자</h3>
        <nav className="flex flex-col gap-2 text-sm">
          <NavLink to="/admin" end className={({isActive})=> isActive? 'text-primary' : 'text-muted-foreground hover:text-foreground'}>대시보드</NavLink>
          <NavLink to="/admin/users" className={({isActive})=> isActive? 'text-primary' : 'text-muted-foreground hover:text-foreground'}>회원관리</NavLink>
          <NavLink to="/admin/positions" className={({isActive})=> isActive? 'text-primary' : 'text-muted-foreground hover:text-foreground'}>포지션</NavLink>
          <NavLink to="/admin/breaking" className={({isActive})=> isActive? 'text-primary' : 'text-muted-foreground hover:text-foreground'}>속보</NavLink>
          <NavLink to="/admin/ads" className={({isActive})=> isActive? 'text-primary' : 'text-muted-foreground hover:text-foreground'}>광고</NavLink>
        </nav>
      </aside>
      <main>
        <Outlet />
      </main>
    </section>
  )
}
