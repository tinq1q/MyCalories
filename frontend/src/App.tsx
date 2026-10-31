import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { DiaryProvider, useDiary } from './storage/DiaryContext'
import AddFood from './screens/AddFood'
import Onboarding from './screens/Onboarding'
import { isOnboardingSkipped } from './screens/onboardingFlag'
import History from './screens/History'
import Weight from './screens/Weight'
import Profile from './screens/Profile'
import Today from './screens/Today'
import NavBar from './ui/NavBar'
import StorageBanner from './ui/StorageBanner'
import { ToastProvider } from './ui/Toast'


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
          <Route path="/history" element={<History />} />
          <Route path="/weight" element={<Weight />} />
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
