import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Entry } from './domain/types'
import { ONBOARDING_SKIPPED_KEY, resetOnboardingSkippedForTests } from './screens/onboardingFlag'
import { emptyState, STORAGE_KEY } from './storage/storage'

const prod = { id: 'p', name: 'X', kcal: 1, protein: 1, fat: 1, carbs: 1, portionG: null, source: 'base' as const }
const entry: Entry = { id: 'e', date: '2026-10-01', meal: 'lunch', product: prod, grams: 100 }

afterEach(() => vi.restoreAllMocks())
beforeEach(() => {
  resetOnboardingSkippedForTests()
  localStorage.clear()
  window.location.hash = '#/'
})

describe('first-visit redirect', () => {
  it('sends a new user to the questionnaire', () => {
    render(<App />)
    expect(screen.getByText('Давайте познакомимся')).toBeInTheDocument()
  })
  it('does not redirect after "Пропустить"', () => {
    localStorage.setItem(ONBOARDING_SKIPPED_KEY, '1')
    render(<App />)
    expect(screen.queryByText('Давайте познакомимся')).not.toBeInTheDocument()
  })
  it('does not redirect a user who already has entries', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...emptyState(), entries: [entry] }))
    render(<App />)
    expect(screen.queryByText('Давайте познакомимся')).not.toBeInTheDocument()
  })

  it('skipping with unwritable storage still leaves the questionnaire and shows the banner', () => {
    resetOnboardingSkippedForTests()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Пропустить' }))
    expect(screen.queryByText('Давайте познакомимся')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Сегодня' })).toBeInTheDocument()
  })
})
