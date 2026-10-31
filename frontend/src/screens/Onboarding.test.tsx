import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { STORAGE_KEY } from '../storage/storage'
import { DiaryProvider } from '../storage/DiaryContext'
import { ToastProvider } from '../ui/Toast'
import Onboarding, { ONBOARDING_SKIPPED_KEY } from './Onboarding'

function Loc() {
  const l = useLocation()
  return <output data-testid="loc">{l.pathname}</output>
}
const norm = (s: string | null) => (s ?? '').replace(/[  ]/g, ' ')

function view() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <DiaryProvider>
        <ToastProvider>
          <Routes>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="*" element={<div>today</div>} />
          </Routes>
          <Loc />
        </ToastProvider>
      </DiaryProvider>
    </MemoryRouter>,
  )
}
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

beforeEach(() => localStorage.clear())

describe('Onboarding', () => {
  it('fills the form, previews the norm and saves the profile on "Готово"', () => {
    view()
    expect(screen.getByRole('button', { name: 'Готово' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Мужской' }))
    type('Возраст', '30')
    type('Рост, см', '180')
    type('Вес, кг', '80')
    fireEvent.change(screen.getByLabelText('Активность'), { target: { value: 'moderate' } })
    fireEvent.click(screen.getByRole('button', { name: 'Держать вес' }))
    expect(norm(screen.getByLabelText('Норма').textContent)).toContain('2 759 ккал')

    fireEvent.click(screen.getByRole('button', { name: 'Готово' }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/')
    expect(screen.getByText('today')).toBeInTheDocument()
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(saved.profile).toMatchObject({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'keep' })
    expect(saved.normHistory[0].kcal).toBe(2759)
  })

  it('rejects out-of-range values', () => {
    view()
    type('Возраст', '5')
    type('Рост, см', '180')
    type('Вес, кг', '80')
    expect(screen.getByRole('button', { name: 'Готово' })).toBeDisabled()
    expect(screen.getByText('От 10 до 100')).toBeInTheDocument()
  })

  it('"Пропустить" sets the skipped flag and leaves', () => {
    view()
    fireEvent.click(screen.getByRole('button', { name: 'Пропустить' }))
    expect(localStorage.getItem(ONBOARDING_SKIPPED_KEY)).not.toBeNull()
    expect(screen.getByText('today')).toBeInTheDocument()
  })
})
