import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import JellyAvatar from './JellyAvatar'

describe('JellyAvatar', () => {
  it('renders an image labelled without body words', () => {
    const { container } = render(<JellyAvatar heightCm={160} sex="female" weightKg={75} />)
    expect(screen.getByRole('img', { name: 'Аватар' })).toBeInTheDocument()
    expect(container.textContent ?? '').not.toMatch(/ИМТ|лишн|плотн/)
    expect(container.innerHTML).not.toMatch(/ИМТ|лишн|плотн/)
  })

  it('draws the dashed goal outline only with a target', () => {
    const { rerender } = render(<JellyAvatar heightCm={180} sex="male" weightKg={95} />)
    expect(screen.queryByTestId('avatar-goal')).toBeNull()
    rerender(<JellyAvatar heightCm={180} sex="male" weightKg={95} targetKg={null} />)
    expect(screen.queryByTestId('avatar-goal')).toBeNull()
    rerender(<JellyAvatar heightCm={180} sex="male" weightKg={95} targetKg={78} />)
    expect(screen.getByTestId('avatar-goal')).toHaveAttribute('stroke-dasharray')
  })

  it('a mini avatar is smaller than a large one', () => {
    render(<JellyAvatar heightCm={180} sex="male" weightKg={80} size="mini" />)
    const svg = screen.getByRole('img', { name: 'Аватар' })
    expect(Number(svg.getAttribute('width'))).toBeLessThan(100)
  })
})
