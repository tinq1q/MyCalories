import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { DiaryProvider, useDiary } from './storage/DiaryContext'
import AddFood from './screens/AddFood'
import Onboarding from './screens/Onboarding'
import { isOnboardingSkipped } from './screens/onboardingFlag'
import Profile from './screens/Profile'
import Today from './screens/Today'
import Glass from './ui/Glass'
import NavBar from './ui/NavBar'
import StorageBanner from './ui/StorageBanner'
import { ToastProvider } from './ui/Toast'

// History and Weight pull in recharts (the biggest dependency), so they are
// split into their own chunks and downloaded only when the screen is opened.
const History = lazy(() => import('./screens/History'))
const Weight = lazy(() => import('./screens/Weight'))

// Shown for the moment a lazy screen's code is still downloading.
function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Glass className="screen-loading" role="status">Загрузка…</Glass>}>
      {children}
    </Suspense>
  )
}

function Shell() {
  const { pathname } = useLocation()
  const { state, warning } = useDiary()
  // First visit: no profile, nothing recorded and the questionnaire was not skipped.
  if (pathname !== '/onboarding' && !state.profile && state.entries.length === 0 && !warning && !isOnboardingSkipped()) {
    return <Navigate to="/onboarding" replace />
  }
  return (
    <div className="app">
      {pathname !== '/onboarding' && <NavBar />}
      <main className="main">
        {/* Storage problems can mean lost data, so they are visible on every screen. */}
        <StorageBanner />
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/add" element={<AddFood />} />
          <Route path="/history" element={<Lazy><History /></Lazy>} />
          <Route path="/weight" element={<Lazy><Weight /></Lazy>} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="*" element={<Today />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <DiaryProvider>
      <ToastProvider>
        <HashRouter>
          <Shell />
        </HashRouter>
      </ToastProvider>
    </DiaryProvider>
  )
}
