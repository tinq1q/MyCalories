import { useState } from 'react'
import type { Product } from '../../domain/types'

type Draft = Omit<Product, 'id' | 'source'>

interface Props {
  initialName: string
  onBack(): void
  onSave(p: Draft): void
}

// Empty / non-numeric / negative -> null.
function num(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export default function CustomProductForm({ initialName, onBack, onSave }: Props) {
  const [f, setF] = useState({ name: initialName.trim(), kcal: '', protein: '', fat: '', carbs: '', portion: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const bind = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) })

  const submit = () => {
    const err: Record<string, string> = {}
    if (!f.name.trim()) err.name = 'Введите название'
    if (num(f.kcal) === null) err.kcal = 'Укажите калории'
    if (num(f.protein) === null) err.protein = 'Укажите белки'
    if (num(f.fat) === null) err.fat = 'Укажите жиры'
    if (num(f.carbs) === null) err.carbs = 'Укажите углеводы'
    const portion = num(f.portion)
    if (f.portion.trim() !== '' && (portion === null || portion <= 0)) err.portion = 'Порция должна быть больше нуля'
    setErrors(err)
    if (Object.keys(err).length) return
    onSave({
      name: f.name.trim(),
      kcal: num(f.kcal)!,
      protein: num(f.protein)!,
      fat: num(f.fat)!,
      carbs: num(f.carbs)!,
      portionG: f.portion.trim() === '' ? null : portion,
    })
  }

  const field = (k: keyof typeof f, label: string, inputMode: 'text' | 'decimal' = 'decimal') => (
    <label className="field">
      <span>{label}</span>
      <input inputMode={inputMode} aria-label={label} aria-invalid={!!errors[k]} {...bind(k)} />
      {errors[k] && <span className="error">{errors[k]}</span>}
    </label>
  )

  return (
    <form
      className="add-step glass custom-form"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      noValidate
    >
      <header className="add-header">
        <button type="button" className="muted link-btn" onClick={onBack}>
          ‹ Назад
        </button>
        <span className="muted">Свой продукт</span>
      </header>
      {field('name', 'Название', 'text')}
      {field('kcal', 'Ккал на 100 г')}
      {field('protein', 'Белки на 100 г')}
      {field('fat', 'Жиры на 100 г')}
      {field('carbs', 'Углеводы на 100 г')}
      {field('portion', 'Порция, г (необязательно)')}
      <button type="submit" className="btn primary cta">
        Сохранить и продолжить
      </button>
    </form>
  )
}
