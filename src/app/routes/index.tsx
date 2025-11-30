import { createBrowserRouter, Navigate } from 'react-router-dom'
import RootLayout from '../layouts/RootLayout'

import BreakingPage from '../../pages/breaking/BreakingPage'
import BreakingDetailPage from '../../pages/breaking/BreakingDetailPage'
import ProfilePage from '../../pages/profile/ProfilePage'

import SearchPage from '../../pages/search/SearchPage'
import NotFoundPage from '../../pages/NotFoundPage'

import NewsLayout from '../../pages/news/Layout'
import NewsPage from '../../pages/news/NewsPage'

import MarketsLayout from '../../pages/markets/Layout'
import CryptoPage from '../../pages/markets/CryptoPage'
import StocksPage from '../../pages/markets/StocksPage'
import FuturesPage from '../../pages/markets/FuturesPage'
import KimchiPage from '../../pages/markets/KimchiPage'
import SchedulePage from '../../pages/markets/SchedulePage'

import PositionsLayout from '../../pages/positions/Layout'
import PositionsPage from '../../pages/positions/PositionsPage'
import WhalesPage from '../../pages/positions/WhalesPage'
import FearGreedPage from '../../pages/positions/FearGreedPage'
import LongShortPage from '../../pages/positions/LongShortPage'


import PaperTradingPage from '../../pages/paper/PaperTradingPage'
import MoreLayout from '../../pages/more/MoreLayout'
import NoticesPage from '../../pages/notices/NoticesPage'
import GuidePage from '../../pages/guide/GuidePage'

import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'


import RequireAdmin from '../../components/auth/RequireAdmin'
import AdminLayout from '../../pages/admin/Layout'
import AdminDashboardPage from '../../pages/admin/DashboardPage'
import AdminBreakingPage from '../../pages/admin/BreakingPage'
import AdminAdsPage from '../../pages/admin/AdsPage'
import AdminUsersPage from '../../pages/admin/UsersPage'
import AdminPositionsPage from '../../pages/admin/PositionsPage'
import AdminAnalyticsPage from '../../pages/admin/AnalyticsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <BreakingPage /> },

      // 뉴스
      {
        path: 'news',
        element: <NewsLayout />,
        children: [{ index: true, element: <NewsPage /> }],
      },

      // 마켓 ★ 수정 완료: /markets → 자동 /markets/stocks 이동
      {
        path: 'markets',
        element: <MarketsLayout />,
        children: [
          { index: true, element: <Navigate to="stocks" replace /> },  // ← 수정된 부분
          { path: 'crypto', element: <CryptoPage /> },
          { path: 'stocks', element: <StocksPage /> },
          { path: 'futures', element: <FuturesPage /> },
          { path: 'kimchi', element: <KimchiPage /> },
          { path: 'schedule', element: <SchedulePage /> },
        ],
      },

      // 포지션
      {
        path: 'positions',
        element: <PositionsLayout />,
        children: [
          { index: true, element: <PositionsPage /> },
          { path: 'live', element: <PositionsPage /> },
          { path: 'fear-greed', element: <FearGreedPage /> },
          { path: 'long-short', element: <LongShortPage /> },
          { path: 'whales', element: <WhalesPage /> },
        ],
      },

      // 커뮤니티

      { path: 'breaking', element: <BreakingPage /> },
      { path: 'breaking/:key', element: <BreakingDetailPage /> },

      { path: 'profile', element: <ProfilePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <RegisterPage /> },
      { path: 'forgot', element: <ForgotPasswordPage /> },

      { path: 'paper', element: <PaperTradingPage /> },

      // 관리자
      {
        path: 'admin',
        element: (
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        ),
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: 'analytics', element: <AdminAnalyticsPage /> },
          { path: 'users', element: <AdminUsersPage /> },
          { path: 'positions', element: <AdminPositionsPage /> },
          { path: 'breaking', element: <AdminBreakingPage /> },
          { path: 'ads', element: <AdminAdsPage /> },
        ],
      },

      // 기타
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
