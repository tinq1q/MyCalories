import { describe, expect, it } from 'vitest'
import { calcNorm, normForDate } from '../domain/norm'
import type { Profile } from '../domain/types'
import { diaryReducer } from './diaryReducer'
import { emptyState } from './storage'

const male: Profile = { sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'keep', trackWeight: true, updatedAt: '' }
const now = '2026-11-01T10:00:00.000Z'

describe('diaryReducer addWeight', () => {
  it('a backdated first weight still updates the norm in force today', () => {
    // Profile saved on 11-01 creates a norm record effective from 11-01.
    let s = diaryReducer(emptyState(), { type: 'setProfile', profile: male, today: '2026-11-01', now })
    // The first weight is entered for an earlier day (10-30).
    s = diaryReducer(s, { type: 'addWeight', weight: { date: '2026-10-30', weightKg: 90 }, now })
    expect(s.profile?.weightKg).toBe(90)
    expect(normForDate(s.normHistory, '2026-11-01')).toEqual(calcNorm({ ...male, weightKg: 90 }))
    // The 11-01 record was recalculated in place, not shadowing a new 10-30 one.
    expect(s.normHistory.map((r) => r.effectiveFrom)).toEqual(['2026-11-01'])
  })

  it('a newer weight still starts a norm record on its own date', () => {
    let s = diaryReducer(emptyState(), { type: 'setProfile', profile: male, today: '2026-11-01', now })
    s = diaryReducer(s, { type: 'addWeight', weight: { date: '2026-11-05', weightKg: 85 }, now })
    expect(s.normHistory.map((r) => r.effectiveFrom)).toEqual(['2026-11-01', '2026-11-05'])
    expect(normForDate(s.normHistory, '2026-11-05')).toEqual(calcNorm({ ...male, weightKg: 85 }))
  })
})
