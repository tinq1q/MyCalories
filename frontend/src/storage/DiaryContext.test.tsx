import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { calcNorm } from '../domain/norm'
import { todayKey } from '../domain/dates'
import type { Product, Profile } from '../domain/types'
import { DiaryProvider, useDiary } from './DiaryContext'
import { STORAGE_KEY } from './storage'

const wrapper = ({ children }: { children: ReactNode }) => <DiaryProvider>{children}</DiaryProvider>
const setup = () => renderHook(() => useDiary(), { wrapper })
const male: Profile = { sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'keep', trackWeight: true, updatedAt: '' }
const prod = (id: string): Product => ({ id, name: id, kcal: 100, protein: 1, fat: 1, carbs: 1, portionG: null, source: 'base' })
const manual = { kcal: 2500, protein: 100, fat: 80, carbs: 300 }

beforeEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  localStorage.clear()
})

describe('DiaryContext', () => {
  it('setProfile adds a calculated norm record and stamps updatedAt', () => {
    const { result } = setup()
    act(() => result.current.setProfile(male))
    const s = result.current.state
    expect(s.normHistory.at(-1)).toEqual({ effectiveFrom: todayKey(), ...calcNorm(male), manual: false })
    expect(s.profile?.updatedAt).not.toBe('')
  })

  it('same-day norm record is replaced, not duplicated', () => {
    const { result } = setup()
    act(() => result.current.setProfile(male))
    act(() => result.current.setProfile({ ...male, weightKg: 90 }))
    expect(result.current.state.normHistory).toHaveLength(1)
    expect(result.current.state.normHistory[0].kcal).toBe(calcNorm({ ...male, weightKg: 90 }).kcal)
  })

  it('manual norm is kept by later setProfile', () => {
    const { result } = setup()
    act(() => result.current.setProfile(male))
    act(() => result.current.setManualNorm(manual))
    expect(result.current.state.normHistory.at(-1)).toMatchObject({ kcal: 2500, manual: true })
    act(() => result.current.setProfile({ ...male, age: 40 }))
    expect(result.current.state.normHistory.at(-1)).toMatchObject({ kcal: 2500, manual: true })
  })

  it('setManualNorm(null) returns the calculated norm', () => {
    const { result } = setup()
    act(() => result.current.setProfile(male))
    act(() => result.current.setManualNorm(manual))
    act(() => result.current.setManualNorm(null))
    expect(result.current.state.normHistory.at(-1)).toEqual({ effectiveFrom: todayKey(), ...calcNorm(male), manual: false })
  })

  it('addWeight with manual norm adds no norm record', () => {
    const { result } = setup()
    act(() => result.current.setProfile(male))
    act(() => result.current.setManualNorm(manual))
    const before = result.current.state.normHistory.length
    act(() => result.current.addWeight({ date: '2099-01-01', weightKg: 85 }))
    expect(result.current.state.normHistory).toHaveLength(before)
    expect(result.current.state.profile?.weightKg).toBe(85)
    expect(result.current.state.weights).toEqual([{ date: '2099-01-01', weightKg: 85 }])
  })

  it('addWeight without manual norm recalculates from the weight date', () => {
    const { result } = setup()
    act(() => result.current.setProfile(male))
    act(() => result.current.addWeight({ date: '2099-01-01', weightKg: 85 }))
    expect(result.current.state.normHistory.at(-1)).toEqual({
      effectiveFrom: '2099-01-01', ...calcNorm({ ...male, weightKg: 85 }), manual: false,
    })
  })

  it('older weight does not change profile weight', () => {
    const { result } = setup()
    act(() => result.current.setProfile(male))
    act(() => result.current.addWeight({ date: '2099-01-01', weightKg: 85 }))
    act(() => result.current.addWeight({ date: '2098-01-01', weightKg: 60 }))
    expect(result.current.state.profile?.weightKg).toBe(85)
    expect(result.current.state.weights.map((w) => w.date)).toEqual(['2098-01-01', '2099-01-01'])
  })

  it('addEntry twice with the same product keeps one recent product; entry ops work', () => {
    const { result } = setup()
    let id = ''
    act(() => { id = result.current.addEntry({ date: '2026-11-01', meal: 'lunch', product: prod('a'), grams: 100 }) })
    act(() => { result.current.addEntry({ date: '2026-11-01', meal: 'snack', product: prod('a'), grams: 50 }) })
    expect(result.current.state.recentProducts).toHaveLength(1)
    act(() => result.current.updateEntryGrams(id, 150))
    const removed = result.current.state.entries.find((e) => e.id === id)!
    expect(removed.grams).toBe(150)
    act(() => result.current.removeEntry(id))
    expect(result.current.state.entries).toHaveLength(1)
    act(() => result.current.restoreEntry(removed))
    expect(result.current.state.entries).toHaveLength(2)
  })

  it('setManualNorm and addWeight stamp profile.updatedAt with the injected now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'))
    const { result } = setup()
    act(() => result.current.setProfile(male))
    vi.setSystemTime(new Date('2031-01-01T00:00:00.000Z'))
    act(() => result.current.setManualNorm(manual))
    expect(result.current.state.profile?.updatedAt).toBe('2031-01-01T00:00:00.000Z')
    vi.setSystemTime(new Date('2032-01-01T00:00:00.000Z'))
    act(() => result.current.addWeight({ date: '2099-01-01', weightKg: 85 }))
    expect(result.current.state.profile?.updatedAt).toBe('2032-01-01T00:00:00.000Z')
  })

  it('saveFailed turns true when setItem throws and clears after a successful save', () => {
    const { result } = setup()
    expect(result.current.saveFailed).toBe(false)
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    act(() => { result.current.addEntry({ date: '2026-11-01', meal: 'lunch', product: prod('a'), grams: 1 }) })
    expect(result.current.saveFailed).toBe(true)
    spy.mockRestore()
    act(() => { result.current.addEntry({ date: '2026-11-01', meal: 'lunch', product: prod('b'), grams: 1 }) })
    expect(result.current.saveFailed).toBe(false)
  })

  it('corrupt-no-backup: STORAGE_KEY untouched until confirmDiscardCorrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{oops')
    const orig = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === 'sitefood:corrupt-backup') throw new Error('quota')
      return orig.call(this, k, v)
    })
    const { result } = setup()
    expect(result.current.warning).toBe('corrupt-no-backup')
    expect(result.current.corruptRaw).toBe('{oops')
    act(() => { result.current.addEntry({ date: '2026-11-01', meal: 'lunch', product: prod('a'), grams: 1 }) })
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{oops')
    act(() => result.current.confirmDiscardCorrupt())
    expect(result.current.corruptRaw).toBeNull()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).entries).toHaveLength(1)
  })

  it('recentProducts is capped at 20', () => {
    const { result } = setup()
    for (let i = 0; i < 25; i++)
      act(() => { result.current.addEntry({ date: '2026-11-01', meal: 'lunch', product: prod('p' + i), grams: 10 }) })
    expect(result.current.state.recentProducts).toHaveLength(20)
    expect(result.current.state.recentProducts[0].id).toBe('p24')
  })

  it('addCustomProduct generates custom id and persists to storage', () => {
    const { result } = setup()
    let p!: Product
    act(() => { p = result.current.addCustomProduct({ name: 'x', kcal: 1, protein: 1, fat: 1, carbs: 1, portionG: null }) })
    expect(p.id.startsWith('custom-')).toBe(true)
    expect(p.source).toBe('custom')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).customProducts).toHaveLength(1)
  })

  it('picks up changes saved by another tab instead of overwriting them', () => {
    const { result } = setup()
    act(() => { result.current.addEntry({ date: '2026-11-01', meal: 'lunch', product: prod('a'), grams: 100 }) })
    // "Another tab" saves its own state (it saw entry a and added entry b).
    const other = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    other.entries.push({ id: 'from-other-tab', date: '2026-11-01', meal: 'dinner', product: prod('b'), grams: 50 })
    const raw = JSON.stringify(other)
    localStorage.setItem(STORAGE_KEY, raw)
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: raw })) })
    expect(result.current.state.entries).toHaveLength(2)
    // A later local change must keep the other tab's entry.
    act(() => { result.current.addEntry({ date: '2026-11-01', meal: 'snack', product: prod('c'), grams: 10 }) })
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(saved.entries.map((e: { product: Product }) => e.product.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('ignores unreadable data from another tab and the reload itself does not save', () => {
    const { result } = setup()
    act(() => { result.current.addEntry({ date: '2026-11-01', meal: 'lunch', product: prod('a'), grams: 100 }) })
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: '{oops' })) })
    expect(result.current.state.entries).toHaveLength(1)
    const raw = JSON.stringify({ ...JSON.parse(localStorage.getItem(STORAGE_KEY)!), entries: [] })
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: raw })) })
    expect(result.current.state.entries).toHaveLength(0)
    // Neither event wrote anything back to storage.
    expect(setItem).not.toHaveBeenCalled()
  })

  it('applyImport merges or replaces; markExported sets timestamp', () => {
    const { result } = setup()
    act(() => { result.current.addEntry({ date: '2026-11-01', meal: 'lunch', product: prod('a'), grams: 100 }) })
    const data = { formatVersion: 1 as const, profile: null, normHistory: [], entries: [], customProducts: [], weights: [] }
    act(() => result.current.applyImport(data, 'merge'))
    expect(result.current.state.entries).toHaveLength(1)
    act(() => result.current.applyImport(data, 'replace'))
    expect(result.current.state.entries).toHaveLength(0)
    act(() => result.current.markExported())
    expect(result.current.state.lastExportAt).not.toBeNull()
  })
})
