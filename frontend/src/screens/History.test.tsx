import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiaryState, Entry, NormRecord, Product } from '../domain/types'
import { DiaryProvider } from '../storage/DiaryContext'
import { emptyState, STORAGE_KEY } from '../storage/storage'
import History from './History'

const prod: Product = { id: 'p', name: 'X', kcal: 100, protein: 0, fat: 0, carbs: 0, portionG: null, source: 'base' }
// 100 kcal per 100 g, so grams == kcal.
const e = (date: string, kcal: number): Entry => ({ id: date, date, meal: 'lunch', product: prod, grams: kcal })
const rec = (effectiveFrom: string, kcal: number): NormRecord => ({ effectiveFrom, kcal, protein: 1, fat: 1, carbs: 1, manual: true })

function seed(patch: Partial<DiaryState>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...emptyState(), ...patch }))
}
function Loc() {
  const l = useLocation()
  return <output data-testid="loc">{l.pathname + l.search}</output>
}
function view() {
  return render(
    <MemoryRouter initialEntries={['/history']}>
      <DiaryProvider>
        <History />
        <Loc />
      </DiaryProvider>
    </MemoryRouter>,
  )
}
const status = (day: string) => screen.getByTestId(`day-${day}`).getAttribute('data-status')

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 1, 12)) // 2026-11-01
  vi.stubGlobal('ResizeObserver', RO)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('History', () => {
  const base = {
    normHistory: [rec('2000-01-01', 2000)],
    entries: [e('2026-10-29', 2100), e('2026-10-30', 2300), e('2026-10-31', 1500)],
  }

  it('marks days by status in the previous month', () => {
    seed(base)
    view()
    fireEvent.click(screen.getByRole('button', { name: 'Предыдущий месяц' }))
    expect(screen.getByRole('heading', { name: /Октябрь 2026/ })).toBeInTheDocument()
    expect(status('2026-10-29')).toBe('ok')
    expect(status('2026-10-30')).toBe('over')
    expect(status('2026-10-31')).toBe('under')
    expect(status('2026-10-28')).toBe('empty')
  })

  it('judges each day by its own norm', () => {
    seed({ ...base, normHistory: [rec('2000-01-01', 2000), rec('2026-10-30', 1800)] })
    view()
    fireEvent.click(screen.getByRole('button', { name: 'Предыдущий месяц' }))
    expect(status('2026-10-29')).toBe('ok')
    expect(status('2026-10-30')).toBe('over')
  })

  it('clicking a day navigates to it; future days are disabled', () => {
    seed(base)
    view()
    fireEvent.click(screen.getByTestId('day-2026-11-01'))
    expect(screen.getByTestId('loc')).toHaveTextContent('/?day=2026-11-01')
    expect(screen.getByTestId('day-2026-11-02')).toBeDisabled()
  })

  it('weeks start on Monday', () => {
    seed(base)
    view()
    expect(screen.getAllByTestId('weekday')[0]).toHaveTextContent('Пн')
  })

  it('switches chart range', () => {
    seed(base)
    view()
    expect(screen.getByRole('button', { name: '7 дней' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '30 дней' }))
    expect(screen.getByRole('button', { name: '30 дней' })).toHaveAttribute('aria-pressed', 'true')
  })
})
