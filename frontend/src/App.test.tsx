import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import type { Entry } from './domain/types'
import { ONBOARDING_SKIPPED_KEY } from './screens/Onboarding'
import { emptyState, STORAGE_KEY } from './storage/storage'

const prod = { id: 'p', name: 'X', kcal: 1, protein: 1, fat: 1, carbs: 1, portionG: null, source: 'base' as const }
const entry: Entry = { id: 'e', date: '2026-10-01', meal: 'lunch', product: prod, grams: 100 }

beforeEach(() => {
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
})
