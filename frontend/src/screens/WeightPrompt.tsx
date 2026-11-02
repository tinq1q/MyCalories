import { useState } from 'react'
import { currentWeight } from '../domain/avatar'
import { addDays, todayKey } from '../domain/dates'
import { parseWeight } from '../domain/weight'
import { WEIGHT_PROMPT_SNOOZE_DAYS, WEIGHT_PROMPT_SNOOZE_KEY } from '../domain/weightPrompt'
import { useDiary } from '../storage/DiaryContext'
import Sheet from '../ui/Sheet'
import { useToast } from '../ui/Toast'

// Weekly «how is your weight?» sheet. Closing it any way but «Сохранить»
// (button, drag down, Escape, backdrop) snoozes it.
export default function WeightPrompt({ onDone }: { onDone(): void }) {
  const { state, addWeight } = useDiary()
  const toast = useToast()
  const profile = state.profile!
  const [text, setText] = useState(String(currentWeight(state.weights, profile)).replace('.', ','))
  const weight = parseWeight(text)

  const snooze = () => {
    try {
      localStorage.setItem(WEIGHT_PROMPT_SNOOZE_KEY, addDays(todayKey(), WEIGHT_PROMPT_SNOOZE_DAYS))
    } catch {
      // storage unavailable: the prompt just returns on the next visit
    }
    onDone()
  }

  const save = () => {
    if (weight === null) return
    addWeight({ date: todayKey(), weightKg: weight })
    toast.show('Вес сохранён')
    onDone()
  }

  return (
    <Sheet label="Вес на этой неделе" onClose={snooze}>
      <h2>Как твой вес на этой неделе?</h2>
      <p className="muted">Человечек обновится, а норма пересчитается.</p>
      <label className="field">
        <span>Вес, кг</span>
        <input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="sheet-actions">
        <button type="button" className="btn" onClick={snooze}>
          Напомнить позже
        </button>
        <button type="button" className="btn primary" disabled={weight === null} onClick={save}>
          Сохранить
        </button>
      </div>
    </Sheet>
  )
}
