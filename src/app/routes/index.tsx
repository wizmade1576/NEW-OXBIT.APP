import { createBrowserRouter } from 'react-router-dom'
import RootLayout from '../layouts/RootLayout'
import HomePage from '../../pages/home/HomePage'
import BreakingPage from '../../pages/breaking/BreakingPage'
import BreakingDetailPage from '../../pages/breaking/BreakingDetailPage'
import SearchPage from '../../pages/search/SearchPage'
import NotFoundPage from '../../pages/NotFoundPage'
import NewsLayout from '../../pages/news/Layout'
import AllPage from '../../pages/news/AllPage'
import NewsPage from '../../pages/news/NewsPage'
import CryptoNewsPage from '../../pages/news/CryptoNewsPage'
import GlobalStocksNewsPage from '../../pages/news/GlobalStocksNewsPage'
import FxRatesNewsPage from '../../pages/news/FxRatesNewsPage'
import MarketsLayout from '../../pages/markets/Layout'
import CryptoPage from '../../pages/markets/CryptoPage'
import StocksPage from '../../pages/markets/StocksPage'
import FuturesPage from '../../pages/markets/FuturesPage'
import KimchiPage from '../../pages/markets/KimchiPage'
import SchedulePage from '../../pages/markets/SchedulePage'
import PositionsPage from '../../pages/positions/PositionsPage'
import PositionsLayout from '../../pages/positions/Layout'
import WhalesPage from '../../pages/positions/WhalesPage'
import FearGreedPage from '../../pages/positions/FearGreedPage'
import CommunityLayout from '../../pages/community/Layout'
import LoungePage from '../../pages/community/LoungePage'
import ExpertsPage from '../../pages/community/ExpertsPage'
import PaperTradingPage from '../../pages/paper/PaperTradingPage'
import MoreLayout from '../../pages/more/MoreLayout'
import NoticesPage from '../../pages/notices/NoticesPage'
import GuidePage from '../../pages/guide/GuidePage'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import AdsPage from '../../pages/ads/AdsPage'
import RequireAdmin from '../../components/auth/RequireAdmin'
import AdminLayout from '../../pages/admin/Layout'
import AdminDashboardPage from '../../pages/admin/DashboardPage'
import AdminBreakingPage from '../../pages/admin/BreakingPage'
import AdminAdsPage from '../../pages/admin/AdsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'news',
        element: <NewsLayout />,
        children: [
          { index: true, element: <AllPage /> },
          { path: 'crypto', element: <CryptoNewsPage /> },
          { path: 'global', element: <GlobalStocksNewsPage /> },
          { path: 'fx', element: <FxRatesNewsPage /> },
        ],
      },
      {
        path: 'markets',
        element: <MarketsLayout />,
        children: [
          { index: true, element: <StocksPage /> },
          { path: 'crypto', element: <CryptoPage /> },
          { path: 'stocks', element: <StocksPage /> },
          { path: 'futures', element: <FuturesPage /> },
          { path: 'kimchi', element: <KimchiPage /> },
          { path: 'schedule', element: <SchedulePage /> },
        ],
      },
      {
        path: 'positions',
        element: <PositionsLayout />,
        children: [
          { index: true, element: <PositionsPage /> },
          { path: 'live', element: <PositionsPage /> },
          { path: 'whales', element: <WhalesPage /> },
          { path: 'fear-greed', element: <FearGreedPage /> },
        ],
      },
      {
        path: 'community',
        element: <CommunityLayout />,
        children: [
          { index: true, element: <LoungePage /> },
          { path: 'lounge', element: <LoungePage /> },
          { path: 'experts', element: <ExpertsPage /> },
        ],
      },
      { path: 'breaking', element: <BreakingPage /> },
      { path: 'breaking/:key', element: <BreakingDetailPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <RegisterPage /> },
      { path: 'forgot', element: <ForgotPasswordPage /> },
      { path: 'paper', element: <PaperTradingPage /> },
      { path: 'ads', element: <AdsPage /> },
      {
        path: 'admin',
        element: (
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        ),
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: 'breaking', element: <AdminBreakingPage /> },
          { path: 'ads', element: <AdminAdsPage /> },
        ],
      },
      {
        path: 'more',
        element: <MoreLayout />,
        children: [
          { index: true, element: <div /> },
          { path: 'notices', element: <NoticesPage /> },
          { path: 'guide', element: <GuidePage /> },
        ],
      },
      { path: 'search', element: <SearchPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default router
