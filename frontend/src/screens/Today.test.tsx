import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { addDays, todayKey } from '../domain/dates'
import type { DiaryState, Entry, Meal, Product } from '../domain/types'
import { emptyState, STORAGE_KEY } from '../storage/storage'
import { DiaryProvider } from '../storage/DiaryContext'
import { ToastProvider } from '../ui/Toast'
import Today from './Today'

const prod: Product = { id: 'p', name: 'Овсянка', kcal: 100, protein: 10, fat: 5, carbs: 20, portionG: null, source: 'base' }
const entry = (id: string, meal: Meal, grams: number, date = todayKey()): Entry => ({ id, date, meal, product: prod, grams })

function seed(patch: Partial<DiaryState>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...emptyState(), ...patch }))
}
const withNorm: Partial<DiaryState> = {
  normHistory: [{ effectiveFrom: '2000-01-01', kcal: 2000, protein: 100, fat: 70, carbs: 250, manual: true }],
  entries: [entry('a', 'breakfast', 600), entry('b', 'lunch', 720)],
}

function view() {
  return render(
    <MemoryRouter>
      <DiaryProvider>
        <ToastProvider>
          <Today />
        </ToastProvider>
      </DiaryProvider>
    </MemoryRouter>,
  )
}
// Intl uses narrow/no-break spaces as thousands separators.
const norm = (s: string | null) => (s ?? '').replace(/[\u00a0\u202f]/g, ' ')
const hasText = (t: string) => (_: string, el: Element | null) => !!el && el.children.length === 0 && norm(el.textContent).includes(t)

beforeEach(() => localStorage.clear())

describe('Today', () => {
  it('shows ring with norm: total, "из 2 000", remaining', () => {
    seed(withNorm)
    view()
    expect(screen.getAllByText(hasText('1 320')).length).toBeGreaterThan(0)
    expect(screen.getByText(hasText('из 2 000'))).toBeInTheDocument()
    expect(screen.getByText(hasText('осталось 680'))).toBeInTheDocument()
  })

  it('without a norm shows only the total and no "из"', () => {
    seed({ entries: withNorm.entries })
    view()
    expect(screen.getByText(hasText('1 320 ккал'))).toBeInTheDocument()
    expect(screen.queryByText(hasText('из'))).toBeNull()
  })

  it('renders meal cards in order and marks empty ones', () => {
    seed(withNorm)
    view()
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles).toEqual(['Завтрак', 'Обед', 'Перекус', 'Ужин'])
    const dinner = screen.getByRole('heading', { name: 'Ужин' }).closest('section')!
    expect(within(dinner).getByText('ещё пусто')).toBeInTheDocument()
  })

  it('"›" goes to tomorrow, which has no data', () => {
    seed(withNorm)
    view()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Сегодня')
    fireEvent.click(screen.getByRole('button', { name: '›' }))
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('Сегодня')
    expect(screen.getAllByText('ещё пусто')).toHaveLength(4)
    expect(addDays(todayKey(), 1)).toBeTruthy()
  })

  it('deleting an entry shows a toast; "Отменить" restores it', () => {
    seed(withNorm)
    view()
    fireEvent.click(screen.getByRole('button', { name: /Овсянка.*600/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    expect(screen.getByText(/Удалено/)).toBeInTheDocument()
    expect(screen.queryByText(hasText('осталось 680'))).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }))
    expect(screen.getByText(hasText('осталось 680'))).toBeInTheDocument()
  })

  it('edits grams with a comma decimal', () => {
    seed(withNorm)
    view()
    fireEvent.click(screen.getByRole('button', { name: /Овсянка.*600/ }))
    fireEvent.change(screen.getByLabelText('Граммы'), { target: { value: '500,5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(screen.getAllByText(hasText('1 221')).length).toBeGreaterThan(0)
  })
})
