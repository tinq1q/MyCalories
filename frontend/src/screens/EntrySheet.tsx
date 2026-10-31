import { useState } from 'react'
import type { Entry } from '../domain/types'
import { nutrientsFor } from '../domain/nutrition'
import { fmt } from '../ui/format'

// Accepts "150", "150.5" and "150,5"; null when not a positive number.
function parseGrams(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 && n <= 10000 ? n : null
}

interface Props {
  entry: Entry
  onSave(grams: number): void
  onDelete(): void
  onClose(): void
}

export default function EntrySheet({ entry, onSave, onDelete, onClose }: Props) {
  const [text, setText] = useState(String(entry.grams).replace('.', ','))
  const grams = parseGrams(text)
  const n = nutrientsFor(entry.product, grams ?? entry.grams)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet glass" role="dialog" aria-modal="true" aria-label={entry.product.name} onClick={(e) => e.stopPropagation()}>
        <h2>{entry.product.name}</h2>
        <label className="field">
          <span>Граммы</span>
          <input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </label>
        {grams === null && <p className="error">Введите число больше нуля</p>}
        <p className="muted">
          {fmt(n.kcal)} ккал · Б {fmt(n.protein)} · Ж {fmt(n.fat)} · У {fmt(n.carbs)}
        </p>
        <div className="sheet-actions">
          <button type="button" className="btn danger" onClick={onDelete}>
            Удалить
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Закрыть
          </button>
          <button type="button" className="btn primary" disabled={grams === null} onClick={() => grams !== null && onSave(grams)}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
