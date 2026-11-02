import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays, todayKey } from '../domain/dates'
import type { DiaryState, Profile } from '../domain/types'
import { DiaryProvider } from '../storage/DiaryContext'
import { emptyState, STORAGE_KEY } from '../storage/storage'
import { ToastProvider } from '../ui/Toast'
import App from '../App'
import Weight from './Weight'

const profile: Profile = {
  sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'keep',
  trackWeight: true, updatedAt: '2026-01-01T00:00:00Z',
}
function seed(patch: Partial<DiaryState>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...emptyState(), ...patch }))
}
function view() {
  return render(
    <MemoryRouter>
      <DiaryProvider>
        <ToastProvider>
          <Weight />
        </ToastProvider>
      </DiaryProvider>
    </MemoryRouter>,
  )
}
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!) as DiaryState
const autoNorm = { effectiveFrom: '2026-01-01', kcal: 1000, protein: 1, fat: 1, carbs: 1, manual: false }

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('ResizeObserver', RO)
})

describe('Weight', () => {
  it('saves "79,5" for today and lists it', () => {
    seed({ profile })
    view()
    fireEvent.change(screen.getByLabelText('Вес, кг'), { target: { value: '79,5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(stored().weights).toEqual([{ date: todayKey(), weightKg: 79.5 }])
    expect(screen.getByTestId('weight-list')).toHaveTextContent('79,5')
  })

  it('disables save for out-of-range weight', () => {
    seed({ profile })
    view()
    fireEvent.change(screen.getByLabelText('Вес, кг'), { target: { value: '20' } })
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled()
  })

  it('shows the recalculated norm after a save that created a new auto norm', () => {
    seed({ profile, normHistory: [autoNorm] })
    view()
    fireEvent.change(screen.getByLabelText('Вес, кг'), { target: { value: '85' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(screen.getByText(/Норма пересчитана: .* ккал/)).toBeInTheDocument()
  })

  it('shows the recalculated norm for a backdated first weight (record on a later day)', () => {
    // The only norm record starts today; the weight is entered for yesterday.
    seed({ profile, normHistory: [{ ...autoNorm, effectiveFrom: todayKey() }] })
    view()
    const yesterday = addDays(todayKey(), -1)
    fireEvent.change(screen.getByLabelText('Вес, кг'), { target: { value: '85' } })
    fireEvent.change(screen.getByLabelText('Дата'), { target: { value: yesterday } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(stored().normHistory).toHaveLength(1)
    expect(stored().normHistory[0].kcal).not.toBe(1000)
    expect(screen.getByText(/Норма пересчитана: .* ккал/)).toBeInTheDocument()
  })

  it('does not show it when a manual norm is in force', () => {
    seed({ profile, normHistory: [{ ...autoNorm, kcal: 2000, manual: true }] })
    view()
    fireEvent.change(screen.getByLabelText('Вес, кг'), { target: { value: '85' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(screen.queryByText(/Норма пересчитана/)).toBeNull()
  })

  it('shows the avatar and goal progress from the earliest to the latest weight', () => {
    seed({
      profile: { ...profile, weightKg: 95, goal: 'lose', targetWeightKg: 78 },
      weights: [
        { date: '2026-10-20', weightKg: 92 },
        { date: '2026-10-01', weightKg: 95 },
      ],
    })
    view()
    expect(screen.getByRole('img', { name: 'Аватар' })).toBeInTheDocument()
    expect(screen.getByTestId('avatar-goal')).toBeInTheDocument()
    expect(screen.getByText('осталось 14 кг')).toBeInTheDocument()
  })

  it('says the goal is reached once the weight passes the target', () => {
    seed({
      profile: { ...profile, weightKg: 95, goal: 'lose', targetWeightKg: 78 },
      weights: [{ date: '2026-10-01', weightKg: 95 }, { date: '2026-10-20', weightKg: 77.5 }],
    })
    view()
    expect(screen.getByText('цель достигнута')).toBeInTheDocument()
  })

  it('shows only the avatar without a goal to reach', () => {
    seed({ profile: { ...profile, goal: 'keep', targetWeightKg: 70 } })
    view()
    expect(screen.getByRole('img', { name: 'Аватар' })).toBeInTheDocument()
    expect(screen.queryByTestId('avatar-goal')).toBeNull()
    expect(screen.queryByTestId('goal-progress')).toBeNull()
    expect(screen.queryByText(/осталось|цель достигнута/)).toBeNull()
  })

  it('route #/weight redirects to / when trackWeight is off', async () => {
    seed({ profile: { ...profile, trackWeight: false } })
    window.location.hash = '#/weight'
    render(<App />)
    // Weight is lazy-loaded, so the redirect happens once its chunk has loaded.
    await waitFor(() => expect(window.location.hash).toBe('#/'), { timeout: 10_000 })
  })
})
