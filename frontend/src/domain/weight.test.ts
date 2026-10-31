import { describe, expect, it } from 'vitest'
import { parseWeight } from './weight'

describe('parseWeight', () => {
  it('accepts comma and dot decimals', () => {
    expect(parseWeight('79,5')).toBe(79.5)
    expect(parseWeight(' 80.25 ')).toBe(80.25)
  })
  it('rejects empty, non-numeric and out of range', () => {
    for (const s of ['', 'abc', '29.9', '300.1', '0', '-5']) expect(parseWeight(s)).toBeNull()
  })
  it('accepts the bounds', () => {
    expect(parseWeight('30')).toBe(30)
    expect(parseWeight('300')).toBe(300)
  })
})
