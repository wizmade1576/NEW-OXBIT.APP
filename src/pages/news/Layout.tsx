import { Outlet } from 'react-router-dom'

export default function NewsLayout() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <Outlet />
    </div>
  )
}
