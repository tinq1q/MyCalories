import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiaryState, Entry } from '../domain/types'
import { CORRUPT_BACKUP_KEY, emptyState, STORAGE_KEY } from '../storage/storage'
import { DiaryProvider } from '../storage/DiaryContext'
import BackupReminder, { REMINDER_HIDDEN_KEY } from './BackupReminder'
import StorageBanner from './StorageBanner'
import { ToastProvider } from './Toast'

const prod = { id: 'p', name: 'X', kcal: 1, protein: 1, fat: 1, carbs: 1, portionG: null, source: 'base' as const }
const entry: Entry = { id: 'e', date: '2026-10-01', meal: 'lunch', product: prod, grams: 100 }
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000).toISOString()

function seed(patch: Partial<DiaryState>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...emptyState(), ...patch }))
}
function view(ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      <DiaryProvider>
        <ToastProvider>{ui}</ToastProvider>
      </DiaryProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('BackupReminder', () => {
  it('shows for entries and an export 8 days ago', () => {
    seed({ entries: [entry], lastExportAt: daysAgo(8) })
    view(<BackupReminder />)
    expect(screen.getByText('Давно не было резервной копии')).toBeInTheDocument()
  })
  it('shows when never exported', () => {
    seed({ entries: [entry] })
    view(<BackupReminder />)
    expect(screen.getByText('Давно не было резервной копии')).toBeInTheDocument()
  })
  it('hidden for an export 6 days ago', () => {
    seed({ entries: [entry], lastExportAt: daysAgo(6) })
    view(<BackupReminder />)
    expect(screen.queryByText('Давно не было резервной копии')).not.toBeInTheDocument()
  })
  it('hidden without entries', () => {
    seed({ lastExportAt: daysAgo(30) })
    view(<BackupReminder />)
    expect(screen.queryByText('Давно не было резервной копии')).not.toBeInTheDocument()
  })
  it('can be hidden for 3 days', () => {
    seed({ entries: [entry] })
    const { unmount } = view(<BackupReminder />)
    fireEvent.click(screen.getByRole('button', { name: 'Скрыть на 3 дня' }))
    expect(screen.queryByText('Давно не было резервной копии')).not.toBeInTheDocument()
    expect(Number(localStorage.getItem(REMINDER_HIDDEN_KEY))).toBeGreaterThan(Date.now() + 2.9 * 24 * 3600 * 1000)
    unmount()
    view(<BackupReminder />)
    expect(screen.queryByText('Давно не было резервной копии')).not.toBeInTheDocument()
  })
})

describe('StorageBanner', () => {
  it('nothing for healthy storage', () => {
    const { container } = view(<StorageBanner />)
    expect(container.querySelector('.banner')).toBeNull()
  })

  it('corrupt: dismissible notice', () => {
    localStorage.setItem(STORAGE_KEY, '{broken')
    view(<StorageBanner />)
    expect(screen.getByText('Данные браузера были повреждены. Мы сохранили копию и начали с чистого дневника.')).toBeInTheDocument()
    expect(localStorage.getItem(CORRUPT_BACKUP_KEY)).toBe('{broken')
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(screen.queryByText(/были повреждены/)).not.toBeInTheDocument()
  })

  it('unavailable storage: offers export', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    view(<StorageBanner />)
    expect(screen.getByText(/Браузер не даёт сохранять данные/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Скачать' })).toBeInTheDocument()
  })

  it('corrupt without backup: blocks, downloads raw data, discards after confirm', () => {
    localStorage.setItem(STORAGE_KEY, '{broken')
    const realSet = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === CORRUPT_BACKUP_KEY) throw new Error('quota')
      return realSet.call(this, k, v)
    })
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const names: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download)
    })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    view(<StorageBanner />)
    expect(screen.getByText(/новые записи не сохраняются/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Скачать повреждённые данные' }))
    expect(names[0]).toMatch(/\.txt$/)

    fireEvent.click(screen.getByRole('button', { name: 'Начать заново' }))
    expect(screen.getByText(/новые записи не сохраняются/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Начать заново' }))
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(screen.queryByText(/новые записи не сохраняются/)).not.toBeInTheDocument()
  })
})
