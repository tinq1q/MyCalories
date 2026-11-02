import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { m } from 'motion/react'
import { currentWeight } from '../domain/avatar'
import { addDays, todayKey } from '../domain/dates'
import { parseWeight } from '../domain/weight'
import { WEIGHT_PROMPT_SNOOZE_DAYS, WEIGHT_PROMPT_SNOOZE_KEY } from '../domain/weightPrompt'
import { useDiary } from '../storage/DiaryContext'
import { FADE, SPRING, useReducedMotionSafe } from '../ui/motion'
import { useToast } from '../ui/Toast'

// Dragging the card down by this much (px) snoozes it.
const DISMISS_DRAG = 80

// Weekly «how is your weight?» card. Closing it any way but «Сохранить» snoozes it.
export default function WeightPrompt({ onDone }: { onDone(): void }) {
  const { state, addWeight } = useDiary()
  const toast = useToast()
  const reduced = useReducedMotionSafe()
  const profile = state.profile!
  const [text, setText] = useState(String(currentWeight(state.weights, profile)).replace('.', ','))
  const [dy, setDy] = useState(0)
  const dragFrom = useRef<number | null>(null)
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

  // Drag-down-to-snooze on the heading area (Motion's drag is not in domAnimation).
  const down = (e: PointerEvent) => {
    dragFrom.current = e.clientY
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const move = (e: PointerEvent) => {
    if (dragFrom.current !== null) setDy(Math.max(0, e.clientY - dragFrom.current))
  }
  const up = () => {
    if (dragFrom.current === null) return
    dragFrom.current = null
    if (dy > DISMISS_DRAG) snooze()
    else setDy(0)
  }

  return (
    <m.section
      className="glass weight-prompt"
      aria-label="Вес на этой неделе"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: dy }}
      transition={reduced || dy > 0 ? FADE : SPRING}
    >
      <div className="weight-prompt-head" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <span className="weight-prompt-grip" aria-hidden="true" />
        <h2>Как твой вес на этой неделе?</h2>
      </div>
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
    </m.section>
  )
}
