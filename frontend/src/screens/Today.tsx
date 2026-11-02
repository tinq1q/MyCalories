import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addDays, isValidDayKey, todayKey } from '../domain/dates'
import { dayTotals, mealTotals, nutrientsFor } from '../domain/nutrition'
import { normForDate } from '../domain/norm'
import { shouldPromptWeight, WEIGHT_PROMPT_SNOOZE_KEY } from '../domain/weightPrompt'
import { MEALS, MEAL_LABELS } from '../domain/types'
import type { Entry } from '../domain/types'
import { useDiary } from '../storage/DiaryContext'
import BackupReminder from '../ui/BackupReminder'
import Glass from '../ui/Glass'
import MacroBars from '../ui/MacroBars'
import Ring from '../ui/Ring'
import { fmt } from '../ui/format'
import { useToast } from '../ui/Toast'
import EntrySheet from './EntrySheet'
import WeightPrompt from './WeightPrompt'

const localDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const dateFmt =new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const weekdayFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'long' })

function dayTitle(day: string, today: string): { title: string; sub: string } {
  const date = localDate(day)
  if (day === today) return { title: 'Сегодня', sub: dateFmt.format(date) }
  if (day === addDays(today, -1)) return { title: 'Вчера', sub: dateFmt.format(date) }
  return { title: dateFmt.format(date), sub: weekdayFmt.format(date) }
}

function readSnooze(): string | null {
  try {
    return localStorage.getItem(WEIGHT_PROMPT_SNOOZE_KEY)
  } catch {
    return null
  }
}

export default function Today() {
  const { state, updateEntryGrams, removeEntry, restoreEntry } = useDiary()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const today = todayKey()
  const raw = params.get('day')
  const day = isValidDayKey(raw) ? raw : today
  // Entry just added from the add-food flow: highlighted briefly, then the param is dropped.
  const newId = params.get('new')
  useEffect(() => {
    if (!newId) return
    const t = window.setTimeout(() => {
      setParams(
        (p) => {
          const next = new URLSearchParams(p)
          next.delete('new')
          return next
        },
        { replace: true },
      )
    }, 2000)
    return () => window.clearTimeout(t)
  }, [newId, setParams])
  const [editing, setEditing] = useState<Entry | null>(null)
  const [promptDone, setPromptDone] = useState(false)
  const [snoozedUntil] = useState(readSnooze)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const go = (n: number) => setParams({ day: addDays(day, n) }, { replace: true })
  const norm = normForDate(state.normHistory, day)
  const totals = dayTotals(state.entries, day)
  const { title, sub } = dayTitle(day, today)
  const remaining = norm ? norm.kcal - totals.kcal : 0

  const remove = (e: Entry) => {
    removeEntry(e.id)
    setEditing(null)
    toast.show('Удалено', { label: 'Отменить', onClick: () => restoreEntry(e) })
  }

  return (
    <div
      className="today"
      onTouchStart={(e) => {
        const t = e.touches[0]
        touchStart.current = { x: t.clientX, y: t.clientY }
      }}
      onTouchEnd={(e) => {
        const s = touchStart.current
        touchStart.current = null
        if (!s) return
        const dx = e.changedTouches[0].clientX - s.x
        const dy = e.changedTouches[0].clientY - s.y
        // Horizontal, deliberate swipes only, so vertical scrolling never changes the day.
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1)
      }}
    >
      <BackupReminder />

      <header className="day-header">
        <button type="button" className="icon-btn" aria-label="Предыдущий день" onClick={() => go(-1)}>
          ‹
        </button>
        <div className="day-title">
          <h1>{title}</h1>
          <span className="muted">{sub}</span>
        </div>
        <button type="button" className="icon-btn" aria-label="Следующий день" onClick={() => go(1)}>
          ›
        </button>
      </header>

      {day === today && !promptDone && shouldPromptWeight(state, today, snoozedUntil) && <WeightPrompt onDone={() => setPromptDone(true)} />}

      <Glass as="section" className="summary" aria-label="Итоги дня">
        <div className="ring-row">
          {norm ? (
            <>
              <Ring value={totals.kcal} max={norm.kcal} />
              <div className="kcal">
                <span>ккал из {fmt(norm.kcal)}</span>
                <span className="muted">{remaining >= 0 ? `осталось ${fmt(remaining)}` : `сверх нормы ${fmt(-remaining)}`}</span>
              </div>
            </>
          ) : (
            <p className="kcal-only">{fmt(totals.kcal)} ккал</p>
          )}
        </div>
        <MacroBars totals={totals} norm={norm} />
      </Glass>

      {MEALS.map((meal) => {
        const items = state.entries.filter((e) => e.date === day && e.meal === meal)
        const t = mealTotals(state.entries, day, meal)
        return (
          <Glass as="section" className={items.length ? 'meal' : 'meal empty'} key={meal}>
            <div className="meal-head">
              <h3>{MEAL_LABELS[meal]}</h3>
              <span className="meal-kcal">{items.length ? fmt(t.kcal) : '—'}</span>
            </div>
            {items.length === 0 ? (
              <p className="muted">ещё пусто</p>
            ) : (
              <ul>
                {items.map((e) => (
                  <li key={e.id}>
                    <button type="button" className={e.id === newId ? 'entry is-new' : 'entry'} onClick={() => setEditing(e)}>
                      <span className="entry-name">{e.product.name}</span>
                      <span className="muted">{fmt(e.grams)} г</span>
                      <span className="entry-kcal">{fmt(nutrientsFor(e.product, e.grams).kcal)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Glass>
        )
      })}

      <Link className="fab" to={`/add?day=${day}`} aria-label="Добавить еду">
        +
      </Link>

      {editing && (
        <EntrySheet
          key={editing.id}
          entry={editing}
          onClose={() => setEditing(null)}
          onDelete={() => remove(editing)}
          onSave={(g) => {
            updateEntryGrams(editing.id, g)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
