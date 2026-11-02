import { describe, expect, it } from 'vitest'
import { shouldCelebrate } from './celebration'

const today = '2026-11-02'

describe('shouldCelebrate', () => {
  it('is true for an ok today that was not celebrated yet', () => {
    expect(shouldCelebrate('ok', today, today, null)).toBe(true)
    expect(shouldCelebrate('ok', today, today, '2026-11-01')).toBe(true)
  })
  it('is false when today was already celebrated', () => {
    expect(shouldCelebrate('ok', today, today, today)).toBe(false)
  })
  it('is false for a past day', () => {
    expect(shouldCelebrate('ok', '2026-11-01', today, null)).toBe(false)
  })
  it('is false when the day is not ok', () => {
    expect(shouldCelebrate('over', today, today, null)).toBe(false)
    expect(shouldCelebrate('under', today, today, null)).toBe(false)
    expect(shouldCelebrate('empty', today, today, null)).toBe(false)
  })
})
