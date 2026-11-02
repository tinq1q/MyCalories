import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays, todayKey } from '../domain/dates'
import type { DiaryState, Entry, Meal, Product } from '../domain/types'
import { emptyState, STORAGE_KEY } from '../storage/storage'
import { WEIGHT_PROMPT_SNOOZE_KEY } from '../domain/weightPrompt'
import { DiaryProvider } from '../storage/DiaryContext'
import { ToastProvider } from '../ui/Toast'
import NavBar from '../ui/NavBar'
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

function Loc() {
  const l = useLocation()
  return <output data-testid="loc">{l.pathname + l.search}</output>
}

function view(url = '/') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <DiaryProvider>
        <ToastProvider>
          <Today />
          <NavBar />
          <Loc />
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
    fireEvent.click(screen.getByRole('button', { name: 'Следующий день' }))
    expect(screen.getByTestId('loc')).toHaveTextContent(`/?day=${addDays(todayKey(), 1)}`)
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('Сегодня')
    expect(screen.getAllByText('ещё пусто')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'Предыдущий день' }))
    expect(screen.getByTestId('loc')).toHaveTextContent(`/?day=${todayKey()}`)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Сегодня')
  })

  it('shows "сверх нормы" when over the norm', () => {
    seed({ ...withNorm, entries: [entry('a', 'breakfast', 2300)] })
    view()
    expect(screen.getByText(hasText('сверх нормы 300'))).toBeInTheDocument()
    expect(screen.queryByText(hasText('осталось'))).toBeNull()
  })

  it('FAB links to /add for the shown day', () => {
    seed(withNorm)
    view('/?day=2025-03-04')
    expect(screen.getByRole('link', { name: 'Добавить еду' })).toHaveAttribute('href', '/add?day=2025-03-04')
  })

  it.each(['garbage', '2025-02-31', '2025-13-01', ''])('invalid ?day=%s falls back to today', (bad) => {
    seed(withNorm)
    view(`/?day=${bad}`)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Сегодня')
    expect(screen.getByRole('link', { name: 'Добавить еду' })).toHaveAttribute('href', `/add?day=${todayKey()}`)
  })

  const swipe = (dx: number, dy: number) => {
    const el = document.querySelector('.today')!
    fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 300 }] })
    fireEvent.touchEnd(el, { changedTouches: [{ clientX: 200 + dx, clientY: 300 + dy }] })
  }

  it('horizontal swipe changes the day (left = next, right = previous)', () => {
    seed(withNorm)
    view()
    swipe(-120, 5)
    expect(screen.getByTestId('loc')).toHaveTextContent(`/?day=${addDays(todayKey(), 1)}`)
    swipe(120, 5)
    expect(screen.getByTestId('loc')).toHaveTextContent(`/?day=${todayKey()}`)
  })

  it('mostly vertical or short swipes are ignored', () => {
    seed(withNorm)
    view()
    swipe(-100, 150)
    swipe(-30, 0)
    expect(screen.getByTestId('loc').textContent).toBe('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Сегодня')
  })

  it('Weight nav item appears only with trackWeight', () => {
    const profile = { sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'keep', updatedAt: '' } as const
    seed({ profile: { ...profile, trackWeight: false } })
    const first = view()
    expect(screen.queryByRole('link', { name: 'Вес' })).toBeNull()
    first.unmount()
    seed({ profile: { ...profile, trackWeight: true } })
    view()
    expect(screen.getByRole('link', { name: 'Вес' })).toBeInTheDocument()
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

  describe('weekly weight prompt', () => {
    const profile = { sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'keep', trackWeight: true, updatedAt: '2020-01-01T00:00:00.000Z' } as const
    const stale = { profile, weights: [{ date: addDays(todayKey(), -8), weightKg: 90 }] }
    const heading = 'Как твой вес на этой неделе?'

    it('shows with an 8-day-old weight, prefilled with the latest weight', () => {
      seed(stale)
      view()
      expect(screen.getByText(heading)).toBeInTheDocument()
      expect(screen.getByLabelText('Вес, кг')).toHaveValue('90')
    })

    it('stays hidden for a recent weight and on other days', () => {
      seed({ profile, weights: [{ date: addDays(todayKey(), -2), weightKg: 90 }] })
      const first = view()
      expect(screen.queryByText(heading)).toBeNull()
      first.unmount()
      seed(stale)
      view(`/?day=${addDays(todayKey(), -1)}`)
      expect(screen.queryByText(heading)).toBeNull()
    })

    it('"Напомнить позже" hides it and stores today + 3 days', () => {
      seed(stale)
      view()
      fireEvent.click(screen.getByRole('button', { name: 'Напомнить позже' }))
      expect(screen.queryByText(heading)).toBeNull()
      expect(localStorage.getItem(WEIGHT_PROMPT_SNOOZE_KEY)).toBe(addDays(todayKey(), 3))
    })

    it('"Сохранить" with 91,5 adds that weight for today and shows a toast', () => {
      seed(stale)
      view()
      fireEvent.change(screen.getByLabelText('Вес, кг'), { target: { value: '91,5' } })
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
      expect(screen.queryByText(heading)).toBeNull()
      expect(screen.getByText('Вес сохранён')).toBeInTheDocument()
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(saved.weights).toContainEqual({ date: todayKey(), weightKg: 91.5 })
    })

    it('cannot save an invalid weight', () => {
      seed(stale)
      view()
      fireEvent.change(screen.getByLabelText('Вес, кг'), { target: { value: '5' } })
      expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled()
    })

    it('stays hidden while snoozed', () => {
      seed(stale)
      localStorage.setItem(WEIGHT_PROMPT_SNOOZE_KEY, addDays(todayKey(), 1))
      view()
      expect(screen.queryByText(heading)).toBeNull()
    })
  })

  describe('new entry highlight', () => {
    afterEach(() => vi.useRealTimers())

    it('highlights ?new=<id> for 2 s, then drops the param', () => {
      vi.useFakeTimers()
      seed(withNorm)
      view(`/?day=${todayKey()}&new=b`)
      const btn = screen.getByRole('button', { name: /Овсянка.*720/ })
      expect(btn).toHaveClass('is-new')
      expect(screen.getByRole('button', { name: /Овсянка.*600/ })).not.toHaveClass('is-new')
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(screen.getByRole('button', { name: /Овсянка.*720/ })).not.toHaveClass('is-new')
      expect(screen.getByTestId('loc')).toHaveTextContent(`/?day=${todayKey()}`)
      expect(screen.getByTestId('loc').textContent).not.toContain('new=')
    })
  })
})
