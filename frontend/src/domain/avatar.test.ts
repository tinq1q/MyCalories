import { describe, expect, it } from 'vitest'
import { bmi, bodyDims, fullness, goalProgress, heightScale, startWeight } from './avatar'
import type { Profile } from './types'

const p: Profile = {
  sex: 'male', age: 30, heightCm: 180, weightKg: 95, activity: 'moderate', goal: 'lose',
  trackWeight: true, targetWeightKg: 78, updatedAt: '2026-01-01T00:00:00Z',
}

describe('avatar shape', () => {
  it('bmi from height and weight', () => {
    expect(bmi(190, 75)).toBeCloseTo(20.78, 2)
    expect(bmi(160, 75)).toBeCloseTo(29.3, 2)
  })
  it('fullness grows with bmi and is clamped', () => {
    expect(fullness(bmi(160, 75))).toBeGreaterThan(fullness(bmi(190, 75)))
    expect(fullness(15)).toBe(0)
    expect(fullness(18)).toBe(0)
    expect(fullness(36)).toBe(1)
    expect(fullness(40)).toBe(1)
    expect(fullness(27)).toBeCloseTo(0.5)
  })
  it('height scale is 1 at 180 cm', () => {
    expect(heightScale(180)).toBe(1)
    expect(heightScale(162)).toBeCloseTo(0.9)
  })
  it('body widens with fullness; female hips are wider relative to shoulders', () => {
    expect(bodyDims('male', 1).waist).toBeGreaterThan(bodyDims('male', 0).waist)
    for (const f of [0, 0.5, 1]) {
      const m = bodyDims('male', f)
      const w = bodyDims('female', f)
      expect(w.hip / w.shoulder).toBeGreaterThan(m.hip / m.shoulder)
    }
  })
})

describe('startWeight', () => {
  it('falls back to the profile weight', () => {
    expect(startWeight([], p)).toBe(95)
  })
  it('takes the earliest record regardless of order', () => {
    const a = { date: '2026-10-01', weightKg: 95 }
    const b = { date: '2026-10-20', weightKg: 92 }
    expect(startWeight([a, b], { ...p, weightKg: 80 })).toBe(95)
    expect(startWeight([b, a], { ...p, weightKg: 80 })).toBe(95)
  })
})

describe('goalProgress', () => {
  it('lose: partial progress', () => {
    const g = goalProgress(p, 92, 95)!
    expect(g.ratio).toBeCloseTo(0.176, 3)
    expect(g.leftKg).toBe(14)
    expect(g.reached).toBe(false)
  })
  it('lose: past the target is reached', () => {
    expect(goalProgress(p, 77, 95)).toEqual({ ratio: 1, leftKg: 0, reached: true })
  })
  it('lose: moving away clamps to 0', () => {
    const g = goalProgress(p, 97, 95)!
    expect(g.ratio).toBe(0)
    expect(g.reached).toBe(false)
  })
  it('gain: progress towards a higher target', () => {
    const g = goalProgress({ ...p, goal: 'gain', targetWeightKg: 70 }, 65, 60)!
    expect(g.ratio).toBeCloseTo(0.5)
    expect(g.leftKg).toBe(5)
    expect(goalProgress({ ...p, goal: 'gain', targetWeightKg: 70 }, 71, 60)!.reached).toBe(true)
  })
  it('null for keep, missing/invalid target or a target against the goal', () => {
    expect(goalProgress({ ...p, goal: 'keep' }, 92, 95)).toBeNull()
    expect(goalProgress({ ...p, targetWeightKg: null }, 92, 95)).toBeNull()
    expect(goalProgress({ ...p, targetWeightKg: undefined }, 92, 95)).toBeNull()
    expect(goalProgress({ ...p, targetWeightKg: '78' as unknown as number }, 92, 95)).toBeNull()
    expect(goalProgress({ ...p, targetWeightKg: NaN }, 92, 95)).toBeNull()
    expect(goalProgress({ ...p, targetWeightKg: 96 }, 92, 95)).toBeNull()
    expect(goalProgress({ ...p, goal: 'gain', targetWeightKg: 90 }, 92, 95)).toBeNull()
  })
})
