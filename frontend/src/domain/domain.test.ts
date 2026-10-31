import { addDays, toDayKey, todayKey } from './dates'
import { dayStatus } from './dayStatus'
import { calcNorm, normForDate } from './norm'
import { dayTotals, defaultMeal, mealTotals, nutrientsFor } from './nutrition'
import { normalizeQuery, searchLocal } from './search'
import type { Entry, NormRecord, Product, Profile } from './types'

const buckwheat: Product = {
  id: 'base-buckwheat-boiled', name: 'Гречка варёная', kcal: 110, protein: 4.2,
  fat: 1.1, carbs: 21.3, portionG: 150, source: 'base',
}
const base: Product[] = [
  { id: 'b2', name: 'Сыр гречневый', kcal: 300, protein: 1, fat: 1, carbs: 1, portionG: null, source: 'base' },
  buckwheat,
  { id: 'b3', name: 'Ёж-конфета', kcal: 400, protein: 1, fat: 1, carbs: 1, portionG: null, source: 'custom' },
  { id: 'b4', name: 'Мёд', kcal: 300, protein: 0, fat: 0, carbs: 80, portionG: null, source: 'base' },
]

const profile = (o: Partial<Profile>): Profile => ({
  sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'keep',
  trackWeight: false, updatedAt: '2026-10-01T00:00:00Z', ...o,
})

describe('dates', () => {
  it('toDayKey uses local date', () => {
    expect(toDayKey(new Date(2026, 9, 31, 23, 30))).toBe('2026-10-31')
  })
  it('addDays crosses month and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('todayKey has day-key format', () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('nutrition', () => {
  it('nutrientsFor rounds', () => {
    expect(nutrientsFor(buckwheat, 180)).toEqual({ kcal: 198, protein: 7.6, fat: 2, carbs: 38.3 })
  })
  const entries: Entry[] = [
    { id: '1', date: '2026-10-31', meal: 'breakfast', product: buckwheat, grams: 100 },
    { id: '2', date: '2026-10-31', meal: 'lunch', product: buckwheat, grams: 200 },
    { id: '3', date: '2026-10-30', meal: 'lunch', product: buckwheat, grams: 100 },
  ]
  it('dayTotals and mealTotals filter correctly', () => {
    expect(dayTotals(entries, '2026-10-31').kcal).toBe(330)
    expect(mealTotals(entries, '2026-10-31', 'lunch').kcal).toBe(220)
    expect(dayTotals(entries, '2026-01-01')).toEqual({ kcal: 0, protein: 0, fat: 0, carbs: 0 })
  })
  it('defaultMeal by hour', () => {
    expect(defaultMeal(new Date(2026, 9, 31, 10, 59))).toBe('breakfast')
    expect(defaultMeal(new Date(2026, 9, 31, 11, 0))).toBe('lunch')
    expect(defaultMeal(new Date(2026, 9, 31, 16, 0))).toBe('snack')
    expect(defaultMeal(new Date(2026, 9, 31, 18, 0))).toBe('dinner')
  })
})

describe('norm', () => {
  it('calcNorm male keep', () => {
    expect(calcNorm(profile({}))).toEqual({ kcal: 2759, protein: 128, fat: 72, carbs: 400 })
  })
  it('calcNorm female lose', () => {
    expect(calcNorm(profile({ sex: 'female', age: 25, heightCm: 165, weightKg: 60, activity: 'sedentary', goal: 'lose' })))
      .toEqual({ kcal: 1372, protein: 120, fat: 54, carbs: 102 })
  })
  const rec = (effectiveFrom: string, kcal: number): NormRecord =>
    ({ effectiveFrom, kcal, protein: 100, fat: 60, carbs: 200, manual: false })
  const h = [rec('2026-10-20', 1800), rec('2026-10-01', 2000)]
  it('normForDate picks latest effective record', () => {
    expect(normForDate(h, '2026-10-19')!.kcal).toBe(2000)
    expect(normForDate(h, '2026-10-20')!.kcal).toBe(1800)
    expect(normForDate(h, '2026-09-30')).toBeNull()
  })
})

describe('dayStatus', () => {
  const norm = { kcal: 2000, protein: 1, fat: 1, carbs: 1 }
  it('classifies', () => {
    expect(dayStatus(2200, true, norm)).toBe('ok')
    expect(dayStatus(2201, true, norm)).toBe('over')
    expect(dayStatus(1800, true, norm)).toBe('ok')
    expect(dayStatus(1799, true, norm)).toBe('under')
    expect(dayStatus(0, false, norm)).toBe('empty')
    expect(dayStatus(500, true, null)).toBe('logged')
  })
})

describe('search', () => {
  it('normalizeQuery', () => {
    expect(normalizeQuery('  ЁЖ ')).toBe('еж')
  })
  it('prefix matches first, then substrings, alphabetical', () => {
    const r = searchLocal(base, 'ГРЕЧ')
    expect(r[0].id).toBe('base-buckwheat-boiled')
    expect(r.map((p) => p.id)).toEqual(['base-buckwheat-boiled', 'b2'])
  })
  it('substring match and limit', () => {
    expect(searchLocal(base, 'неви')).toEqual([])
    expect(searchLocal(base, 'ка', 1)).toHaveLength(1)
  })
  it('treats ё and е the same', () => {
    expect(searchLocal(base, 'ёж')).toEqual(searchLocal(base, 'еж'))
    expect(searchLocal(base, 'ёж')).toHaveLength(1)
  })
})
