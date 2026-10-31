import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { parseGrams } from '../domain/grams'
import type { DiaryState, Entry, Product } from '../domain/types'
import { emptyState, STORAGE_KEY } from '../storage/storage'
import { DiaryProvider } from '../storage/DiaryContext'
import { ToastProvider } from '../ui/Toast'
import AddFood from './AddFood'

const mocks = vi.hoisted(() => ({ getBaseProducts: vi.fn(), offSearch: vi.fn() }))
vi.mock('../api/client', async (orig) => {
  const actual = await orig<typeof import('../api/client')>()
  return { ...actual, api: { ...actual.api, getBaseProducts: mocks.getBaseProducts, offSearch: mocks.offSearch } }
})

const buckwheat: Product = { id: 'b1', name: 'Гречка варёная', kcal: 110, protein: 4.2, fat: 1.1, carbs: 21.3, portionG: null, source: 'base' }
const bread: Product = { id: 'b2', name: 'Хлеб ржаной', kcal: 210, protein: 6, fat: 1, carbs: 40, portionG: 150, source: 'base' }
const DAY = '2026-11-01'

function seed(patch: Partial<DiaryState>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...emptyState(), ...patch }))
}
function Loc() {
  const l = useLocation()
  return <output data-testid="loc">{l.pathname + l.search}</output>
}
const flush = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
async function view(url = `/add?day=${DAY}&meal=snack`) {
  const r = render(
    <MemoryRouter initialEntries={[url]}>
      <DiaryProvider>
        <ToastProvider>
          <Routes>
            <Route path="/add" element={<AddFood />} />
            <Route path="*" element={<div>today</div>} />
          </Routes>
          <Loc />
        </ToastProvider>
      </DiaryProvider>
    </MemoryRouter>,
  )
  await flush(0)
  return r
}
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })
const search = () => screen.getByLabelText('Поиск продукта')
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!) as DiaryState

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  mocks.getBaseProducts.mockReset().mockResolvedValue([buckwheat, bread])
  mocks.offSearch.mockReset().mockResolvedValue([])
})
afterEach(() => vi.useRealTimers())

describe('parseGrams', () => {
  it('parses with comma and clamps', () => {
    expect(parseGrams('12,5')).toBe(12.5)
    expect(parseGrams(' 180 ')).toBe(180)
    expect(parseGrams('0')).toBeNull()
    expect(parseGrams('')).toBeNull()
    expect(parseGrams('-5')).toBeNull()
    expect(parseGrams('abc')).toBeNull()
    expect(parseGrams('99999')).toBe(5000)
  })
})

describe('AddFood search', () => {
  it('shows the meal chips with the URL meal selected, and recents without a query', async () => {
    seed({ recentProducts: [buckwheat] })
    await view()
    expect(screen.getByRole('button', { name: 'Перекус' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Завтрак' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Недавние')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Гречка варёная/ })).toBeInTheDocument()
  })

  it('base product is visible immediately while OFF hangs; "Будим сервер" after 5 s', async () => {
    mocks.offSearch.mockReturnValue(new Promise(() => {}))
    await view()
    type(search(), 'греч')
    await flush(0)
    expect(screen.getByRole('button', { name: /Гречка варёная/ })).toBeInTheDocument()
    expect(screen.queryByText(/Будим сервер/)).toBeNull()
    await flush(5000)
    expect(screen.getByText('Будим сервер, это до минуты…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Гречка варёная/ })).toBeInTheDocument()
  })

  it('on ApiError shows the unavailable note and keeps local results', async () => {
    mocks.offSearch.mockRejectedValue(new ApiError('unavailable'))
    await view()
    type(search(), 'греч')
    await flush(400)
    expect(screen.getByText('Большая база сейчас недоступна')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Гречка варёная/ })).toBeInTheDocument()
  })

  it('debounces: one OFF request for fast typing "г","гр","гре"', async () => {
    await view()
    for (const q of ['г', 'гр', 'гре']) {
      type(search(), q)
      await flush(100)
    }
    await flush(400)
    expect(mocks.offSearch).toHaveBeenCalledTimes(1)
    expect(mocks.offSearch.mock.calls[0][0]).toBe('гре')
  })

  it('renders remote results under "Большая база"', async () => {
    mocks.offSearch.mockResolvedValue([{ ...buckwheat, id: 'off1', name: 'Гречка Мистраль', source: 'off' }])
    await view()
    type(search(), 'греч')
    await flush(400)
    expect(screen.getByText('Большая база')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Гречка Мистраль/ })).toBeInTheDocument()
  })

  it('works when the base cannot be loaded (recent + custom only)', async () => {
    mocks.getBaseProducts.mockRejectedValue(new ApiError('network'))
    seed({ recentProducts: [buckwheat] })
    await view()
    type(search(), 'греч')
    await flush(0)
    expect(screen.getByRole('button', { name: /Гречка варёная/ })).toBeInTheDocument()
  })
})

describe('AddFood amount step', () => {
  async function pick(p = 'Гречка варёная') {
    await view()
    type(search(), p.slice(0, 5))
    await flush(0)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(p) }))
  }

  it('shows 198 kcal for 180 g and adds an entry with meal/grams/date', async () => {
    await pick()
    type(screen.getByLabelText('Граммы'), '180')
    expect(screen.getByText('198')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Добавить в перекус' }))
    const e = stored().entries[0] as Entry
    expect(e).toMatchObject({ meal: 'snack', grams: 180, date: DAY })
    expect(e.product.id).toBe('b1')
    expect(screen.getByTestId('loc').textContent).toBe(`/?day=${DAY}&new=${e.id}`)
    expect(screen.getByText('Добавлено')).toBeInTheDocument()
  })

  it('empty grams disables the add button', async () => {
    await pick()
    type(screen.getByLabelText('Граммы'), '')
    expect(screen.getByRole('button', { name: 'Добавить в перекус' })).toBeDisabled()
  })

  it('undo in the toast removes the entry', async () => {
    await pick()
    fireEvent.click(screen.getByRole('button', { name: 'Добавить в перекус' }))
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }))
    expect(stored().entries).toHaveLength(0)
  })

  it('no "порция" chip without portionG', async () => {
    await pick()
    expect(screen.queryByRole('button', { name: 'порция' })).toBeNull()
  })

  it('"порция" chip sets portionG', async () => {
    await pick('Хлеб ржаной')
    fireEvent.click(screen.getByRole('button', { name: 'порция' }))
    expect(screen.getByLabelText('Граммы')).toHaveValue('150')
  })

  it('plus/minus change by 10 and the slider is capped at 1000', async () => {
    await pick()
    type(screen.getByLabelText('Граммы'), '100')
    fireEvent.click(screen.getByRole('button', { name: 'Больше на 10 г' }))
    expect(screen.getByLabelText('Граммы')).toHaveValue('110')
    fireEvent.click(screen.getByRole('button', { name: 'Меньше на 10 г' }))
    fireEvent.click(screen.getByRole('button', { name: 'Меньше на 10 г' }))
    expect(screen.getByLabelText('Граммы')).toHaveValue('90')
    expect(screen.getByLabelText('Ползунок граммов')).toHaveAttribute('max', '1000')
  })

  it('last used grams of the same product are offered and preselected', async () => {
    const last: Entry = { id: 'e1', date: '2026-10-30', meal: 'lunch', product: buckwheat, grams: 180 }
    const older: Entry = { id: 'e0', date: '2026-10-20', meal: 'lunch', product: buckwheat, grams: 60 }
    seed({ entries: [older, last], recentProducts: [buckwheat] })
    await view()
    fireEvent.click(screen.getByRole('button', { name: /Гречка варёная/ }))
    expect(screen.getByLabelText('Граммы')).toHaveValue('180')
    expect(screen.getByRole('button', { name: '180 г' })).toBeInTheDocument()
  })

  it('shows what remains of the norm', async () => {
    seed({ normHistory: [{ effectiveFrom: '2000-01-01', kcal: 2000, protein: 100, fat: 70, carbs: 250, manual: true }] })
    await pick()
    type(screen.getByLabelText('Граммы'), '180')
    expect(screen.getByText(/останется 1\D?802 ккал/)).toBeInTheDocument()
  })
})

describe('AddFood custom product', () => {
  async function openForm() {
    await view()
    type(search(), 'нечто')
    await flush(0)
    fireEvent.click(screen.getByRole('button', { name: /Создать свой продукт/ }))
  }

  it('requires calories', async () => {
    await openForm()
    type(screen.getByLabelText('Название'), 'Мой салат')
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить и продолжить' }))
    expect(screen.getByText('Укажите калории')).toBeInTheDocument()
    // Nothing was saved: the form stayed on screen.
    expect(screen.getByLabelText('Название')).toBeInTheDocument()
  })

  it('creates the product and moves on to the amount step', async () => {
    await openForm()
    type(screen.getByLabelText('Название'), 'Мой салат')
    type(screen.getByLabelText('Ккал на 100 г'), '80,5')
    type(screen.getByLabelText('Белки на 100 г'), '2')
    type(screen.getByLabelText('Жиры на 100 г'), '3')
    type(screen.getByLabelText('Углеводы на 100 г'), '9')
    type(screen.getByLabelText('Порция, г (необязательно)'), '200')
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить и продолжить' }))
    expect(stored().customProducts[0]).toMatchObject({ name: 'Мой салат', kcal: 80.5, portionG: 200, source: 'custom' })
    expect(screen.getByRole('button', { name: 'порция' })).toBeInTheDocument()
  })
})
