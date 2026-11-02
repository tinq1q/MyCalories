import { useState } from 'react'
import { m } from 'motion/react'
import { dayTotals, nutrientsFor } from '../../domain/nutrition'
import { normForDate } from '../../domain/norm'
import { MAX_GRAMS, parseGrams } from '../../domain/grams'
import { MEAL_LABELS } from '../../domain/types'
import type { Meal, Product } from '../../domain/types'
import { useDiary } from '../../storage/DiaryContext'
import Glass from '../../ui/Glass'
import { fmt } from '../../ui/format'
import { SPRING, useReducedMotionSafe } from '../../ui/motion'

const STEP = 10
const SLIDER_MAX = 1000
// Accusative case for the button label: "Добавить в завтрак".
const MEAL_IN: Record<Meal, string> = { breakfast: 'завтрак', lunch: 'обед', snack: 'перекус', dinner: 'ужин' }

interface Props {
  product: Product
  meal: Meal
  day: string
  onBack(): void
  onAdd(grams: number): void
}

export default function AmountStep({ product, meal, day, onBack, onAdd }: Props) {
  const { state } = useDiary()
  const reduced = useReducedMotionSafe()

  // Grams of the most recent entry with this product (latest date; later in the list wins ties).
  let lastGrams: number | null = null
  let lastDate = ''
  for (const e of state.entries) {
    if (e.product.id === product.id && e.date >= lastDate) {
      lastDate = e.date
      lastGrams = e.grams
    }
  }

  const [text, setText] = useState(String(lastGrams ?? 100).replace('.', ','))
  const grams = parseGrams(text)
  const n = nutrientsFor(product, grams ?? 0)

  const norm = normForDate(state.normHistory, day)
  const remaining = norm ? norm.kcal - dayTotals(state.entries, day).kcal - n.kcal : null

  const set = (g: number) => setText(String(g).replace('.', ','))
  const bump = (d: number) => set(Math.min(MAX_GRAMS, Math.max(STEP, Math.round(((grams ?? 0) + d) * 10) / 10)))

  const quick: { label: string; value: number }[] = [
    { label: '100 г', value: 100 },
    { label: '250 г', value: 250 },
  ]
  if (product.portionG) quick.push({ label: 'порция', value: product.portionG })
  if (lastGrams && !quick.some((c) => c.value === lastGrams && c.label !== 'порция')) {
    quick.unshift({ label: `${fmt(lastGrams)} г`, value: lastGrams })
  }

  return (
    <div className="add-step">
      <header className="add-header">
        <button type="button" className="muted link-btn" onClick={onBack}>
          ‹ Назад
        </button>
        <span className="muted">{MEAL_LABELS[meal]}</span>
      </header>

      {/* Grows out of the search result card that was tapped. */}
      <m.div className="glass" layoutId={reduced ? undefined : `product-${product.id}`} transition={SPRING}>
        {/* layout="position": the text only moves with the card, never stretches. */}
        <m.h1 className="product-title" layout={reduced ? undefined : 'position'} transition={SPRING}>
          {product.name}
        </m.h1>
        <m.p className="muted" layout={reduced ? undefined : 'position'} transition={SPRING}>
          на 100 г: {fmt(product.kcal)} ккал · Б {fmt(product.protein)} · Ж {fmt(product.fat)} · У {fmt(product.carbs)}
        </m.p>
      </m.div>

      <Glass className="grams-card">
        <div className="grams-row">
          <button type="button" className="round-btn" aria-label="Меньше на 10 г" onClick={() => bump(-STEP)}>
            −
          </button>
          <label className="grams-input">
            <input inputMode="decimal" aria-label="Граммы" value={text} onChange={(e) => setText(e.target.value)} />
            <span>г</span>
          </label>
          <button type="button" className="round-btn" aria-label="Больше на 10 г" onClick={() => bump(STEP)}>
            +
          </button>
        </div>
        <input
          type="range"
          className="slider"
          aria-label="Ползунок граммов"
          min={0}
          max={SLIDER_MAX}
          step={STEP}
          value={Math.min(grams ?? 0, SLIDER_MAX)}
          onChange={(e) => set(Number(e.target.value))}
        />
      </Glass>

      <div className="chips quick">
        {quick.map((c) => (
          <button key={c.label} type="button" className={grams === c.value ? 'chip on' : 'chip'} onClick={() => set(c.value)}>
            {c.label}
          </button>
        ))}
      </div>

      <Glass className="nums">
        <div>
          <b>{fmt(n.kcal)}</b>ккал
        </div>
        <div>
          <b style={{ color: 'var(--protein)' }}>{fmt(n.protein)}</b>белки
        </div>
        <div>
          <b style={{ color: 'var(--fat)' }}>{fmt(n.fat)}</b>жиры
        </div>
        <div>
          <b style={{ color: 'var(--carbs)' }}>{fmt(n.carbs)}</b>углев.
        </div>
      </Glass>

      {grams === null && <p className="error">Введите количество граммов</p>}
      {remaining !== null && grams !== null && (
        <p className="muted center">
          {remaining >= 0
            ? `после добавления останется ${fmt(remaining)} ккал на сегодня`
            : `после добавления будет сверх нормы ${fmt(-remaining)} ккал`}
        </p>
      )}

      <button type="button" className="btn primary cta" disabled={grams === null} onClick={() => grams !== null && onAdd(grams)}>
        Добавить в {MEAL_IN[meal]}
      </button>
    </div>
  )
}
