import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { DiaryProvider, useDiary } from './storage/DiaryContext'
import AddFood from './screens/AddFood'
import Onboarding, { ONBOARDING_SKIPPED_KEY } from './screens/Onboarding'
import Placeholder from './screens/Placeholder'
import Profile from './screens/Profile'
import Today from './screens/Today'
import NavBar from './ui/NavBar'
import { ToastProvider } from './ui/Toast'

function skippedOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_SKIPPED_KEY) !== null
  } catch {
    return false
  }
}

function Shell() {
  const { pathname } = useLocation()
  const { state } = useDiary()
  // First visit: no profile, nothing recorded and the questionnaire was not skipped.
  if (pathname !== '/onboarding' && !state.profile && state.entries.length === 0 && !skippedOnboarding()) {
    return <Navigate to="/onboarding" replace />
  }
  return (
    <div className="app">
      {pathname !== '/onboarding' && <NavBar />}
      <main className="main">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/add" element={<AddFood />} />
          <Route path="/history" element={<Placeholder title="История" />} />
          <Route path="/weight" element={<Placeholder title="Вес" />} />
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
