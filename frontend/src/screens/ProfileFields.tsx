import type { Activity, Goal, Profile, Sex } from '../domain/types'

export const ACTIVITY_LABELS: Record<Activity, string> = {
  sedentary: 'Сидячая работа',
  light: 'Лёгкая активность 1–3 раза в неделю',
  moderate: 'Тренировки 3–5 раз',
  high: 'Тренировки 6–7 раз',
  extreme: 'Тяжёлый физический труд / 2 тренировки в день',
}
const GOAL_LABELS: Record<Goal, string> = { lose: 'Похудеть', keep: 'Держать вес', gain: 'Набрать' }
const SEX_LABELS: Record<Sex, string> = { male: 'Мужской', female: 'Женский' }

// Numbers stay strings while editing so the user can clear a field.
export interface Draft {
  sex: Sex
  age: string
  heightCm: string
  weightKg: string
  targetWeightKg: string
  activity: Activity
  goal: Goal
  trackWeight: boolean
}

export const emptyDraft: Draft = { sex: 'male', age: '', heightCm: '', weightKg: '', targetWeightKg: '', activity: 'light', goal: 'keep', trackWeight: true }

export const draftFrom = (p: Profile): Draft => ({
  sex: p.sex,
  age: String(p.age),
  heightCm: String(p.heightCm),
  weightKg: String(p.weightKg),
  targetWeightKg: p.targetWeightKg == null ? '' : String(p.targetWeightKg),
  activity: p.activity,
  goal: p.goal,
  trackWeight: p.trackWeight,
})

const inRange = (s: string, min: number, max: number): number | null => {
  const n = Number(s.replace(',', '.'))
  return s.trim() !== '' && Number.isFinite(n) && n >= min && n <= max ? n : null
}

// The target must lie on the goal's side of the current weight; keep has no target.
const targetWrongSide = (d: Draft): boolean => {
  const weight = inRange(d.weightKg, 30, 300)
  const target = inRange(d.targetWeightKg, 30, 300)
  if (weight === null || target === null) return false
  return d.goal === 'lose' ? target >= weight : d.goal === 'gain' ? target <= weight : false
}

// The stored target is already reached (logged weights move profile.weightKg):
// left untouched it is kept as is and does not block saving the other fields.
const targetReached = (d: Draft, base?: Draft): boolean =>
  base !== undefined && d.goal === base.goal && d.targetWeightKg.trim() === base.targetWeightKg.trim() && targetWrongSide(d)

// Returns a complete profile, or null while any field is invalid.
// base: the draft the form started from (the stored profile), if any.
export function profileFromDraft(d: Draft, base?: Draft): Profile | null {
  const age = inRange(d.age, 10, 100)
  const heightCm = inRange(d.heightCm, 100, 250)
  const weightKg = inRange(d.weightKg, 30, 300)
  if (age === null || heightCm === null || weightKg === null) return null
  const targetWeightKg = d.goal === 'keep' ? null : inRange(d.targetWeightKg, 30, 300)
  if (d.goal !== 'keep' && d.targetWeightKg.trim() !== '' && targetWeightKg === null) return null
  if (targetWrongSide(d) && !targetReached(d, base)) return null
  return {
    sex: d.sex,
    age: Math.round(age),
    heightCm,
    weightKg,
    targetWeightKg,
    activity: d.activity,
    goal: d.goal,
    trackWeight: d.trackWeight,
    updatedAt: new Date().toISOString(),
  }
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Record<T, string>; onChange(v: T): void }) {
  return (
    <div className="field" role="group" aria-label={label}>
      <span>{label}</span>
      <div className="chips">
        {(Object.keys(options) as T[]).map((k) => (
          <button key={k} type="button" className={k === value ? 'chip on' : 'chip'} aria-pressed={k === value} onClick={() => onChange(k)}>
            {options[k]}
          </button>
        ))}
      </div>
    </div>
  )
}

function Num({ label, value, min, max, onChange }: { label: string; value: string; min: number; max: number; onChange(v: string): void }) {
  const bad = value !== '' && inRange(value, min, max) === null
  return (
    <label className="field">
      {label}
      <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={bad} />
      {bad && (
        <span className="error">
          От {min} до {max}
        </span>
      )}
    </label>
  )
}

export default function ProfileFields({ draft, base, onChange }: { draft: Draft; base?: Draft; onChange(d: Draft): void }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v })
  return (
    <div className="form-stack">
      <Choice label="Пол" value={draft.sex} options={SEX_LABELS} onChange={(v) => set('sex', v)} />
      <Num label="Возраст" value={draft.age} min={10} max={100} onChange={(v) => set('age', v)} />
      <Num label="Рост, см" value={draft.heightCm} min={100} max={250} onChange={(v) => set('heightCm', v)} />
      <Num label="Вес, кг" value={draft.weightKg} min={30} max={300} onChange={(v) => set('weightKg', v)} />
      <label className="field">
        Активность
        <select value={draft.activity} onChange={(e) => set('activity', e.target.value as Activity)}>
          {(Object.keys(ACTIVITY_LABELS) as Activity[]).map((k) => (
            <option key={k} value={k}>
              {ACTIVITY_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <Choice label="Цель" value={draft.goal} options={GOAL_LABELS} onChange={(v) => set('goal', v)} />
      {draft.goal !== 'keep' && (
        <>
          <Num label="Желаемый вес, кг" value={draft.targetWeightKg} min={30} max={300} onChange={(v) => set('targetWeightKg', v)} />
          {targetReached(draft, base) ? (
            <span className="muted">Цель достигнута — укажите новый желаемый вес</span>
          ) : (
            targetWrongSide(draft) && (
              <span className="error">
                Для цели «{GOAL_LABELS[draft.goal]}» желаемый вес должен быть {draft.goal === 'lose' ? 'меньше' : 'больше'} текущего
              </span>
            )
          )}
        </>
      )}
      <label className="check">
        <input type="checkbox" checked={draft.trackWeight} onChange={(e) => set('trackWeight', e.target.checked)} />
        Отслеживать вес
      </label>
    </div>
  )
}
