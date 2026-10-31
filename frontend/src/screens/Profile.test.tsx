import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import type { DiaryState, ExportData, Profile as ProfileT } from '../domain/types'
import { emptyState, STORAGE_KEY } from '../storage/storage'
import { DiaryProvider } from '../storage/DiaryContext'
import { ToastProvider } from '../ui/Toast'
import ProfileScreen from './Profile'

const mocks = vi.hoisted(() => ({ exportDiary: vi.fn(), importDiary: vi.fn() }))
vi.mock('../api/client', async (orig) => {
  const actual = await orig<typeof import('../api/client')>()
  return { ...actual, api: { ...actual.api, exportDiary: mocks.exportDiary, importDiary: mocks.importDiary } }
})

const profile: ProfileT = {
  sex: 'male',
  age: 30,
  heightCm: 180,
  weightKg: 80,
  activity: 'moderate',
  goal: 'keep',
  trackWeight: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
}
const calc = { effectiveFrom: '2000-01-01', kcal: 2759, protein: 128, fat: 72, carbs: 400, manual: false }

function seed(patch: Partial<DiaryState>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...emptyState(), ...patch }))
}
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
const norm = (s: string | null) => (s ?? '').replace(/[  ]/g, ' ')

function view() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <DiaryProvider>
        <ToastProvider>
          <ProfileScreen />
        </ToastProvider>
      </DiaryProvider>
    </MemoryRouter>,
  )
}

const prod = { id: 'p', name: 'X', kcal: 1, protein: 1, fat: 1, carbs: 1, portionG: null, source: 'base' as const }
const imported = (): ExportData => ({
  formatVersion: 1,
  profile: null,
  normHistory: [],
  entries: [1, 2, 3].map((i) => ({ id: `i${i}`, date: '2026-10-01', meal: 'lunch' as const, product: prod, grams: 100 })),
  customProducts: [],
  weights: [],
})
async function pickFile() {
  const file = new File(['x'], 'd.xlsx')
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Файл дневника'), { target: { files: [file] } })
  })
}

beforeEach(() => {
  localStorage.clear()
  mocks.exportDiary.mockReset()
  mocks.importDiary.mockReset()
})
afterEach(() => vi.restoreAllMocks())

describe('Profile', () => {
  it('shows the stored profile and saves edits', () => {
    seed({ profile, normHistory: [calc] })
    view()
    expect(norm(screen.getByLabelText('Норма').textContent)).toContain('2 759 ккал')
    fireEvent.change(screen.getByLabelText('Вес, кг'), { target: { value: '75' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(stored().profile.weightKg).toBe(75)
  })

  it('sets and clears a manual norm', () => {
    seed({ profile, normHistory: [calc] })
    view()
    fireEvent.click(screen.getByRole('button', { name: 'Изменить вручную' }))
    fireEvent.change(screen.getByLabelText('Ккал'), { target: { value: '2200' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить норму' }))
    expect(norm(screen.getByLabelText('Норма').textContent)).toContain('2 200 ккал')
    expect(stored().normHistory.some((r: { manual: boolean }) => r.manual)).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Вернуть расчётную' }))
    expect(norm(screen.getByLabelText('Норма').textContent)).toContain('2 759 ккал')
  })

  it('export downloads a client-named .xlsx and marks the export', async () => {
    seed({ profile, normHistory: [calc] })
    mocks.exportDiary.mockResolvedValue(new Blob(['x']))
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const names: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download)
    })
    view()
    fireEvent.click(screen.getByRole('button', { name: 'Скачать дневник' }))
    await waitFor(() => expect(stored().lastExportAt).not.toBeNull())
    expect(names[0]).toMatch(/^SiteFood-дневник-\d{4}-\d{2}-\d{2}\.xlsx$/)
    expect(mocks.exportDiary.mock.calls[0][0]).not.toHaveProperty('lastExportAt')
  })

  it('import: shows counts and row errors, "Объединить" merges', async () => {
    mocks.importDiary.mockResolvedValue({ data: imported(), errors: [{ sheet: 'Записи', row: 4, message: 'плохая дата' }] })
    view()
    await pickFile()
    expect(await screen.findByText(/Найдено: 3 записей/)).toBeInTheDocument()
    expect(screen.getByText('Лист «Записи», строка 4: плохая дата')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Объединить' }))
    expect(stored().entries).toHaveLength(3)
  })

  it('import: lists at most 20 errors plus a remainder line', async () => {
    const errors = Array.from({ length: 25 }, (_, i) => ({ sheet: 'S', row: i + 1, message: 'm' }))
    mocks.importDiary.mockResolvedValue({ data: imported(), errors })
    view()
    await pickFile()
    expect(await screen.findByText('и ещё 5 ошибок')).toBeInTheDocument()
    expect(screen.queryByText('Лист «S», строка 21: m')).not.toBeInTheDocument()
  })

  it('import: "Заменить всё" needs a confirm', async () => {
    seed({ entries: [{ id: 'old', date: '2026-10-02', meal: 'lunch', product: prod, grams: 5 }] })
    mocks.importDiary.mockResolvedValue({ data: imported(), errors: [] })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    view()
    await pickFile()
    fireEvent.click(await screen.findByRole('button', { name: 'Заменить всё' }))
    expect(stored().entries.map((e: { id: string }) => e.id)).toEqual(['old'])
    fireEvent.click(screen.getByRole('button', { name: 'Заменить всё' }))
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(stored().entries.map((e: { id: string }) => e.id)).toEqual(['i1', 'i2', 'i3'])
  })

  it('import failure shows a server message and leaves existing data untouched', async () => {
    seed({ profile, normHistory: [calc], entries: [{ id: 'old', date: '2026-10-02', meal: 'lunch', product: prod, grams: 5 }] })
    mocks.importDiary.mockRejectedValue(new ApiError('network'))
    view()
    await pickFile()
    expect(await screen.findByText('Не удалось связаться с сервером, попробуйте ещё раз')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Объединить' })).not.toBeInTheDocument()
    expect(mocks.importDiary).toHaveBeenCalledTimes(1)
    expect(stored().entries.map((e: { id: string }) => e.id)).toEqual(['old'])
    expect(stored().profile.weightKg).toBe(80)
  })

  it('bad file (400) shows the file message, not the server one', async () => {
    mocks.importDiary.mockRejectedValue(new ApiError('bad-file', 'nope'))
    view()
    await pickFile()
    expect(await screen.findByText(/Не удалось прочитать файл/)).toBeInTheDocument()
    expect(screen.queryByText(/связаться с сервером/)).not.toBeInTheDocument()
  })

  it('"Заменить всё" is disabled for an empty file; merge stays available', async () => {
    mocks.importDiary.mockResolvedValue({ data: { ...imported(), entries: [] }, errors: [] })
    view()
    await pickFile()
    expect(await screen.findByRole('button', { name: 'Заменить всё' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Объединить' })).toBeEnabled()
  })

  it('replace confirm text carries the counts', async () => {
    mocks.importDiary.mockResolvedValue({ data: imported(), errors: [] })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    view()
    await pickFile()
    fireEvent.click(await screen.findByRole('button', { name: 'Заменить всё' }))
    expect(confirm.mock.calls[0][0]).toContain('3 записей')
  })

  it('the trackWeight toggle reaches the saved profile', () => {
    seed({ profile, normHistory: [calc] })
    view()
    fireEvent.click(screen.getByLabelText('Отслеживать вес'))
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(stored().profile.trackWeight).toBe(false)
  })

  it('after an import the form shows the imported profile, not stale values', async () => {
    seed({ profile, normHistory: [calc] })
    const other: ProfileT = { ...profile, weightKg: 70, age: 44, updatedAt: '2026-06-01T00:00:00.000Z' }
    mocks.importDiary.mockResolvedValue({ data: { ...imported(), profile: other }, errors: [] })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    view()
    expect(screen.getByLabelText('Вес, кг')).toHaveValue('80')
    await pickFile()
    fireEvent.click(await screen.findByRole('button', { name: 'Заменить всё' }))
    expect(screen.getByLabelText('Вес, кг')).toHaveValue('70')
    expect(screen.getByLabelText('Возраст')).toHaveValue('44')
  })
})
