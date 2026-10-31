import { useState } from 'react'
import { calcNorm, normForDate } from '../domain/norm'
import { todayKey } from '../domain/dates'
import type { Norm } from '../domain/types'
import { useDiary } from '../storage/DiaryContext'
import Glass from '../ui/Glass'
import NormPreview from './NormPreview'

const FIELDS: { key: keyof Norm; label: string }[] = [
  { key: 'kcal', label: 'Ккал' },
  { key: 'protein', label: 'Белки, г' },
  { key: 'fat', label: 'Жиры, г' },
  { key: 'carbs', label: 'Углеводы, г' },
]

export default function NormCard() {
  const { state, setManualNorm } = useDiary()
  const current = normForDate(state.normHistory, todayKey())
  const latest = state.normHistory.reduce<(typeof state.normHistory)[number] | null>(
    (b, r) => (!b || r.effectiveFrom > b.effectiveFrom ? r : b),
    null,
  )
  const [editing, setEditing] = useState(false)
  const [vals, setVals] = useState<Record<keyof Norm, string>>({ kcal: '', protein: '', fat: '', carbs: '' })

  const start = () => {
    const base = current ?? (state.profile ? calcNorm(state.profile) : { kcal: 2000, protein: 100, fat: 70, carbs: 250 })
    setVals({ kcal: String(base.kcal), protein: String(base.protein), fat: String(base.fat), carbs: String(base.carbs) })
    setEditing(true)
  }
  const parsed = FIELDS.map((f) => Number(vals[f.key]))
  const valid = FIELDS.every((f, i) => vals[f.key].trim() !== '' && Number.isFinite(parsed[i]) && parsed[i] >= 0) && parsed[0] > 0
  const save = () => {
    if (!valid) return
    setManualNorm({ kcal: Math.round(parsed[0]), protein: Math.round(parsed[1]), fat: Math.round(parsed[2]), carbs: Math.round(parsed[3]) })
    setEditing(false)
  }

  return (
    <Glass as="section" className="card-stack">
      <h2>Норма</h2>
      {current ? <NormPreview norm={current} /> : <p className="muted">Заполните анкету, чтобы рассчитать норму.</p>}
      {latest?.manual && <p className="muted">Задана вручную</p>}
      {editing ? (
        <>
          <div className="form-stack">
            {FIELDS.map((f) => (
              <label className="field" key={f.key}>
                {f.label}
                <input inputMode="numeric" value={vals[f.key]} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />
              </label>
            ))}
          </div>
          <div className="sheet-actions">
            <button type="button" className="btn" onClick={() => setEditing(false)}>
              Отмена
            </button>
            <button type="button" className="btn primary" disabled={!valid} onClick={save}>
              Сохранить норму
            </button>
          </div>
        </>
      ) : (
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={start}>
            Изменить вручную
          </button>
          {latest?.manual && state.profile && (
            <button type="button" className="btn" onClick={() => setManualNorm(null)}>
              Вернуть расчётную
            </button>
          )}
        </div>
      )}
    </Glass>
  )
}
