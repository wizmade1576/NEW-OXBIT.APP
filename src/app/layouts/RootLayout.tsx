import { Outlet, useLocation } from 'react-router-dom'
import Header from '../../components/navigation/Header'
import SearchBar from '../../components/navigation/SearchBar'
import TickerBar from '../../components/navigation/TickerBar'

export default function RootLayout() {
  const location = useLocation()
  const showSearchBar = location.pathname === '/'
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      {showSearchBar && (
        <>
          <SearchBar />
          <div className="mt-4 sm:mt-6 md:mt-8">
            <TickerBar />
          </div>
        </>
      )}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  )
}
