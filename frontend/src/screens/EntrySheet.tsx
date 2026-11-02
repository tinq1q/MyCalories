import { useState } from 'react'
import type { Entry } from '../domain/types'
import { parseGrams } from '../domain/grams'
import { nutrientsFor } from '../domain/nutrition'
import { fmt } from '../ui/format'
import Sheet from '../ui/Sheet'

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
    <Sheet label={entry.product.name} onClose={onClose}>
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
    </Sheet>
  )
}
