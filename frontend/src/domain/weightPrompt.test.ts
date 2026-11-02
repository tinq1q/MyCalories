import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import type { DiaryState, Profile } from './types'
import { shouldPromptWeight } from './weightPrompt'
import { emptyState } from '../storage/storage'

const today = '2026-11-02'
const profile = (patch: Partial<Profile> = {}): Profile => ({
  sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'keep',
  trackWeight: true, updatedAt: '2026-10-01T10:00:00.000Z', ...patch,
})
const st = (patch: Partial<DiaryState>): DiaryState => ({ ...emptyState(), profile: profile(), ...patch })
const weightAgo = (n: number) => [{ date: addDays(today, -n), weightKg: 80 }]

describe('shouldPromptWeight', () => {
  it('is false for a fresh profile without weights', () => {
    expect(shouldPromptWeight(st({ profile: profile({ updatedAt: '2026-11-02T08:00:00' }) }), today, null)).toBe(false)
  })
  it('is true for an old profile without weights', () => {
    expect(shouldPromptWeight(st({}), today, null)).toBe(true)
  })
  it('is true when the last weight is 8 days old, false at 6', () => {
    expect(shouldPromptWeight(st({ weights: weightAgo(8) }), today, null)).toBe(true)
    expect(shouldPromptWeight(st({ weights: weightAgo(7) }), today, null)).toBe(true)
    expect(shouldPromptWeight(st({ weights: weightAgo(6) }), today, null)).toBe(false)
  })
  it('uses the latest record', () => {
    expect(shouldPromptWeight(st({ weights: [...weightAgo(20), ...weightAgo(2)] }), today, null)).toBe(false)
  })
  it('is false while snoozed, true again after', () => {
    const s = st({ weights: weightAgo(8) })
    expect(shouldPromptWeight(s, today, addDays(today, 1))).toBe(false)
    expect(shouldPromptWeight(s, today, today)).toBe(false)
    expect(shouldPromptWeight(s, today, addDays(today, -1))).toBe(true)
  })
  it('is false without a profile or with trackWeight off', () => {
    expect(shouldPromptWeight(st({ profile: null, weights: weightAgo(8) }), today, null)).toBe(false)
    expect(shouldPromptWeight(st({ profile: profile({ trackWeight: false }), weights: weightAgo(8) }), today, null)).toBe(false)
  })
  it('is false for an unparsable updatedAt without weights', () => {
    expect(shouldPromptWeight(st({ profile: profile({ updatedAt: '' }) }), today, null)).toBe(false)
  })
})
