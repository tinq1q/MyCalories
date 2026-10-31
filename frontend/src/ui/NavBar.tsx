import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useDiary } from '../storage/DiaryContext'

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
)

const ICONS = {
  today: icon(<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>),
  history: icon(<><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16" /></>),
  weight: icon(<path d="M4 17l5-5 4 3 7-8" />),
  profile: icon(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1-4 4-5 7-5s6 1 7 5" /></>),
}

// Bottom bar below 768px, side menu above (see theme.css).
export default function NavBar() {
  const { state } = useDiary()
  const items = [
    { to: '/', label: 'Сегодня', icon: ICONS.today, end: true },
    { to: '/history', label: 'История', icon: ICONS.history, end: false },
    ...(state.profile?.trackWeight ? [{ to: '/weight', label: 'Вес', icon: ICONS.weight, end: false }] : []),
    { to: '/profile', label: 'Профиль', icon: ICONS.profile, end: false },
  ]
  return (
    <nav className="nav glass" aria-label="Основное меню">
      <span className="nav-brand">SiteFood</span>
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} className="nav-item">
          {i.icon}
          <span>{i.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
