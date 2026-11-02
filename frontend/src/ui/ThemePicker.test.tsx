import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DiaryProvider, useDiary } from '../storage/DiaryContext'
import { STORAGE_KEY } from '../storage/storage'
import ThemePicker from './ThemePicker'
import { useApplyTheme } from './useApplyTheme'

// The picker plus the hook that App's Shell calls, wired to the real store.
function Harness() {
  const { state } = useDiary()
  useApplyTheme(state.theme)
  return <ThemePicker />
}

function view() {
  return render(
    <DiaryProvider>
      <Harness />
    </DiaryProvider>,
  )
}

describe('ThemePicker', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('shows four themes with Citrus checked by default', () => {
    view()
    const group = screen.getByRole('radiogroup', { name: 'Тема' })
    expect(group).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    for (const name of ['Цитрус', 'Закат', 'Океан', 'Ночь']) {
      expect(screen.getByRole('radio', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('radio', { name: 'Цитрус' })).toBeChecked()
    expect(document.documentElement.dataset.theme).toBe('citrus')
  })

  it('choosing Ocean stores the theme and applies it to the page', () => {
    view()
    fireEvent.click(screen.getByRole('radio', { name: 'Океан' }))
    expect(screen.getByRole('radio', { name: 'Океан' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Цитрус' })).not.toBeChecked()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').theme).toBe('ocean')
    expect(document.documentElement.dataset.theme).toBe('ocean')
  })
})
