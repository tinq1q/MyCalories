import { render, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fmt } from './format'
import { AnimatedNumber, useReducedMotionSafe } from './motion'

// What Motion reports for the user's prefers-reduced-motion setting.
const media = vi.hoisted(() => ({ reduced: null as boolean | null }))
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => media.reduced,
}))

function stubMatchMedia() {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
}

afterEach(() => {
  media.reduced = null
  vi.unstubAllGlobals()
})

describe('useReducedMotionSafe', () => {
  it('follows the user setting when the browser can tell', () => {
    stubMatchMedia()
    media.reduced = true
    expect(renderHook(() => useReducedMotionSafe()).result.current).toBe(true)
    media.reduced = false
    expect(renderHook(() => useReducedMotionSafe()).result.current).toBe(false)
  })

  it('assumes reduced motion without matchMedia (jsdom, old browsers)', () => {
    vi.stubGlobal('matchMedia', undefined)
    media.reduced = false
    expect(renderHook(() => useReducedMotionSafe()).result.current).toBe(true)
  })
})

// fmt uses a narrow no-break space as thousands separator, so text is compared raw.
describe('AnimatedNumber', () => {
  it('renders the final formatted value at once under reduced motion', () => {
    stubMatchMedia()
    media.reduced = true
    const { container, rerender } = render(<p><AnimatedNumber value={1320} /> ккал</p>)
    expect(container.textContent).toBe(`${fmt(1320)} ккал`)
    rerender(<p><AnimatedNumber value={2450.5} /> ккал</p>)
    expect(container.textContent).toBe(`${fmt(2450.5)} ккал`)
  })

  it('renders the final value at once in tests (no matchMedia)', () => {
    const { container } = render(<b><AnimatedNumber value={1500} /></b>)
    expect(container.textContent).toBe(fmt(1500))
  })

  it('counts up to the value when motion is allowed', async () => {
    stubMatchMedia()
    media.reduced = false
    const { container } = render(<b><AnimatedNumber value={1900} /></b>)
    expect(container.textContent).toBe('0')
    await waitFor(() => expect(container.textContent).toBe(fmt(1900)), { timeout: 3000 })
  })
})
