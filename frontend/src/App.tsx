import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { DiaryProvider } from './storage/DiaryContext'
import AddFood from './screens/AddFood'
import Placeholder from './screens/Placeholder'
import Today from './screens/Today'
import NavBar from './ui/NavBar'
import { ToastProvider } from './ui/Toast'

function Shell() {
  const { pathname } = useLocation()
  return (
    <div className="app">
      {pathname !== '/onboarding' && <NavBar />}
      <main className="main">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/add" element={<AddFood />} />
          <Route path="/history" element={<Placeholder title="История" />} />
          <Route path="/weight" element={<Placeholder title="Вес" />} />
          <Route path="/profile" element={<Placeholder title="Профиль" />} />
          <Route path="/onboarding" element={<Placeholder title="Знакомство" />} />
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
