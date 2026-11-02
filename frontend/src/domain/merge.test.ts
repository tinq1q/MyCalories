import { describe, expect, it } from 'vitest'
import { emptyState } from '../storage/storage'
import { mergeDiary, replaceDiary } from './merge'
import type { Entry, ExportData, Product, Profile } from './types'

const prod = (id: string): Product => ({ id, name: id, kcal: 1, protein: 1, fat: 1, carbs: 1, portionG: null, source: 'custom' })
const entry = (id: string, grams = 100): Entry => ({ id, date: '2026-10-01', meal: 'lunch', product: prod('p'), grams })
const profile = (updatedAt: string, weightKg = 70): Profile => ({
  sex: 'male', age: 30, heightCm: 180, weightKg, activity: 'light', goal: 'keep', trackWeight: true, updatedAt,
})
const incoming = (o: Partial<ExportData>): ExportData => ({
  formatVersion: 1, profile: null, normHistory: [], entries: [], customProducts: [], weights: [], ...o,
})

describe('mergeDiary', () => {
  it('unions entries by id keeping current versions', () => {
    const cur = { ...emptyState(), entries: [entry('e1'), entry('e2', 100)] }
    const m = mergeDiary(cur, incoming({ entries: [entry('e2', 999), entry('e3')] }))
    expect(m.entries.map((e) => e.id)).toEqual(['e1', 'e2', 'e3'])
    expect(m.entries[1].grams).toBe(100)
  })

  it('unions custom products by id', () => {
    const cur = { ...emptyState(), customProducts: [prod('a')] }
    const m = mergeDiary(cur, incoming({ customProducts: [prod('a'), prod('b')] }))
    expect(m.customProducts.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('weights merge by date, incoming wins', () => {
    const cur = { ...emptyState(), weights: [{ date: '2026-10-30', weightKg: 70 }, { date: '2026-10-31', weightKg: 71 }] }
    const m = mergeDiary(cur, incoming({ weights: [{ date: '2026-10-31', weightKg: 99 }, { date: '2026-11-01', weightKg: 72 }] }))
    expect(m.weights).toEqual([
      { date: '2026-10-30', weightKg: 70 },
      { date: '2026-10-31', weightKg: 99 },
      { date: '2026-11-01', weightKg: 72 },
    ])
  })

  it('takes profile and normHistory from the newer profile', () => {
    const nh = [{ effectiveFrom: '2026-10-01', kcal: 1, protein: 1, fat: 1, carbs: 1, manual: false }]
    const cur = { ...emptyState(), profile: profile('2026-01-01T00:00:00Z'), normHistory: [{ ...nh[0], kcal: 5 }] }
    const m = mergeDiary(cur, incoming({ profile: profile('2026-06-01T00:00:00Z', 80), normHistory: nh }))
    expect(m.profile?.weightKg).toBe(80)
    expect(m.normHistory).toEqual(nh) // same effectiveFrom: fresher (incoming) record wins
  })

  it('unions normHistory by effectiveFrom, keeping the stale side unique records', () => {
    const rec = (d: string, kcal: number) => ({ effectiveFrom: d, kcal, protein: 1, fat: 1, carbs: 1, manual: false })
    const cur = { ...emptyState(), profile: profile('2026-01-01T00:00:00Z'), normHistory: [rec('2026-01-01', 1), rec('2026-03-01', 2)] }
    const m = mergeDiary(cur, incoming({ profile: profile('2026-06-01T00:00:00Z'), normHistory: [rec('2026-03-01', 99), rec('2026-05-01', 3)] }))
    expect(m.normHistory.map((r) => [r.effectiveFrom, r.kcal])).toEqual([['2026-01-01', 1], ['2026-03-01', 99], ['2026-05-01', 3]])
    const cur2 = { ...cur, profile: profile('2026-09-01T00:00:00Z') }
    const m2 = mergeDiary(cur2, incoming({ profile: profile('2026-06-01T00:00:00Z'), normHistory: [rec('2026-03-01', 99), rec('2026-05-01', 3)] }))
    expect(m2.normHistory.map((r) => [r.effectiveFrom, r.kcal])).toEqual([['2026-01-01', 1], ['2026-03-01', 2], ['2026-05-01', 3]])
  })

  it('keeps current profile when it is newer or equal', () => {
    const cur = { ...emptyState(), profile: profile('2026-06-01T00:00:00Z', 70) }
    const m = mergeDiary(cur, incoming({ profile: profile('2026-01-01T00:00:00Z', 80) }))
    expect(m.profile?.weightKg).toBe(70)
  })

  it('uses whichever side has a profile', () => {
    const m = mergeDiary(emptyState(), incoming({ profile: profile('2026-01-01T00:00:00Z') }))
    expect(m.profile).not.toBeNull()
    const cur = { ...emptyState(), profile: profile('2026-01-01T00:00:00Z') }
    expect(mergeDiary(cur, incoming({})).profile).not.toBeNull()
  })

  it('keeps recentProducts and lastExportAt from current', () => {
    const cur = { ...emptyState(), recentProducts: [prod('r')], lastExportAt: 'x' }
    const m = mergeDiary(cur, incoming({}))
    expect(m.recentProducts).toEqual([prod('r')])
    expect(m.lastExportAt).toBe('x')
  })
})

describe('replaceDiary', () => {
  it('takes data from incoming, local fields from current', () => {
    const cur = { ...emptyState(), entries: [entry('old')], recentProducts: [prod('r')], lastExportAt: 'x' }
    const r = replaceDiary(cur, incoming({ entries: [entry('new')] }))
    expect(r.entries.map((e) => e.id)).toEqual(['new'])
    expect(r.recentProducts).toEqual([prod('r')])
    expect(r.lastExportAt).toBe('x')
  })
})

describe('theme and target weight on import', () => {
  it('merge keeps the current theme', () => {
    const m = mergeDiary({ ...emptyState(), theme: 'ocean' }, incoming({ theme: 'sunset' }))
    expect(m.theme).toBe('ocean')
  })

  it('replace takes a valid incoming theme', () => {
    expect(replaceDiary({ ...emptyState(), theme: 'ocean' }, incoming({ theme: 'sunset' })).theme).toBe('sunset')
  })

  it('replace keeps the current theme when the file has none or an invalid one', () => {
    const cur = { ...emptyState(), theme: 'ocean' as const }
    expect(replaceDiary(cur, incoming({})).theme).toBe('ocean')
    expect(replaceDiary(cur, incoming({ theme: null })).theme).toBe('ocean')
    expect(replaceDiary(cur, incoming({ theme: 'pink' as never })).theme).toBe('ocean')
  })

  it('a newer incoming profile with targetWeightKg wins whole', () => {
    const cur = { ...emptyState(), profile: profile('2026-10-01T00:00:00Z') }
    const inc = { ...profile('2026-10-02T00:00:00Z'), targetWeightKg: 70 }
    expect(mergeDiary(cur, incoming({ profile: inc })).profile).toEqual(inc)
  })
})
