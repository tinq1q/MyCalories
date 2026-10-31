import { useState } from 'react'
import { useExport } from '../hooks/useExport'
import { useDiary } from '../storage/DiaryContext'
import Glass from './Glass'

const WEEK_MS = 7 * 24 * 3600 * 1000
const HIDE_MS = 3 * 24 * 3600 * 1000
export const REMINDER_HIDDEN_KEY = 'sitefood:backup-reminder-hidden-until'

function hiddenUntil(): number {
  try {
    return Number(localStorage.getItem(REMINDER_HIDDEN_KEY)) || 0
  } catch {
    return 0
  }
}

export default function BackupReminder() {
  const { state } = useDiary()
  const { run, busy } = useExport()
  const [hidden, setHidden] = useState(() => Date.now() < hiddenUntil())

  const last = state.lastExportAt ? Date.parse(state.lastExportAt) : NaN
  const stale = Number.isNaN(last) || Date.now() - last > WEEK_MS
  if (state.entries.length === 0 || !stale || hidden) return null

  const hide = () => {
    try {
      localStorage.setItem(REMINDER_HIDDEN_KEY, String(Date.now() + HIDE_MS))
    } catch {
      /* the in-memory flag below still hides it for this visit */
    }
    setHidden(true)
  }

  return (
    <Glass as="aside" className="banner" role="status">
      <span>Давно не было резервной копии</span>
      <span className="banner-actions">
        <button type="button" className="chip" disabled={busy} onClick={run}>
          Скачать
        </button>
        <button type="button" className="chip" onClick={hide} aria-label="Скрыть на 3 дня">
          ✕
        </button>
      </span>
    </Glass>
  )
}
