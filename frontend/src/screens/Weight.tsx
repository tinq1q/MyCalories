import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { isValidDayKey, todayKey } from '../domain/dates'
import { normForDate } from '../domain/norm'
import { parseWeight } from '../domain/weight'
import { useDiary } from '../storage/DiaryContext'
import { fmt } from '../ui/format'
import Glass from '../ui/Glass'
import { useToast } from '../ui/Toast'

const ruDate = (key: string) => `${key.slice(8)}.${key.slice(5, 7)}.${key.slice(0, 4)}`
// Colours come from the active theme (theme.css variables).
const tick = { fill: 'var(--chart-axis)', fontSize: 11 }

export default function Weight() {
  const { state, addWeight } = useDiary()
  const toast = useToast()
  const [text, setText] = useState('')
  const [date, setDate] = useState(todayKey)
  // The norm history as it was before saving; used to detect a recalculation.
  const [saved, setSaved] = useState<{ before: string } | null>(null)

  if (!state.profile?.trackWeight) return <Navigate to="/" replace />

  const weight = parseWeight(text)
  const canSave = weight !== null && isValidDayKey(date) && date <= todayKey()

  const save = () => {
    if (weight === null || !canSave) return
    setSaved({ before: JSON.stringify(state.normHistory) })
    addWeight({ date, weightKg: weight })
    setText('')
    toast.show('Вес сохранён')
  }

  // Shown when saving changed the norm history. The reducer only touches the
  // latest (non-manual) record, which may sit on a later day than the weight,
  // so the message shows the norm in force today.
  const last = state.normHistory.at(-1)
  const recalculated =
    saved && last && !last.manual && JSON.stringify(state.normHistory) !== saved.before
      ? normForDate(state.normHistory, todayKey())
      : null

  const points = state.weights.map((w) => ({ label: ruDate(w.date).slice(0, 5), kg: w.weightKg }))
  const recent = [...state.weights].reverse().slice(0, 10)

  return (
    <div className="weight">
      <h1>Вес</h1>
      <Glass as="section" className="card-stack">
        <label className="field">
          Вес, кг
          <input
            inputMode="decimal"
            value={text}
            placeholder="79,5"
            onChange={(e) => {
              setText(e.target.value)
              setSaved(null)
            }}
          />
        </label>
        <label className="field">
          Дата
          <input type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button type="button" className="btn primary" disabled={!canSave} onClick={save}>
          Сохранить
        </button>
        {recalculated && <p className="muted">Норма пересчитана: {fmt(recalculated.kcal)} ккал</p>}
      </Glass>

      {points.length > 1 && (
        <Glass as="section" className="chart-card">
          <h2>Динамика</h2>
          <div className="chart-box" data-testid="weight-chart">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={tick} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--glass-border)', borderRadius: 12 }}
                  formatter={(v) => [`${v} кг`, 'Вес']}
                />
                <Line dataKey="kg" stroke="var(--chart-line)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--chart-dot)', stroke: 'none' }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Glass>
      )}

      {recent.length > 0 && (
        <Glass as="section" className="card-stack">
          <h2>Последние записи</h2>
          <ul data-testid="weight-list">
            {recent.map((w) => (
              <li key={w.date} className="weight-row">
                <span>{ruDate(w.date)}</span>
                <b>{fmt(w.weightKg)} кг</b>
              </li>
            ))}
          </ul>
        </Glass>
      )}
    </div>
  )
}
