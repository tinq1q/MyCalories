import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY, emptyState, loadState, saveState } from './storage'

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('storage', () => {
  it('returns empty state without warning when nothing is stored', () => {
    const r = loadState()
    expect(r.warning).toBeNull()
    expect(r.state).toEqual(emptyState())
  })

  it('round-trips state', () => {
    const s = { ...emptyState(), lastExportAt: '2026-01-01T00:00:00.000Z' }
    expect(saveState(s)).toBe(true)
    expect(loadState()).toEqual({ state: s, warning: null })
  })

  it('backs up unparsable JSON and starts empty', () => {
    localStorage.setItem(STORAGE_KEY, '{oops')
    const r = loadState()
    expect(r.warning).toBe('corrupt')
    expect(r.state).toEqual(emptyState())
    expect(localStorage.getItem('sitefood:corrupt-backup')).toBe('{oops')
  })

  it('treats a parsed value without expected arrays as corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{"entries": 5}')
    const r = loadState()
    expect(r.warning).toBe('corrupt')
    expect(localStorage.getItem('sitefood:corrupt-backup')).toBe('{"entries": 5}')
  })

  it('reports unavailable when getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const r = loadState()
    expect(r.warning).toBe('unavailable')
    expect(r.state).toEqual(emptyState())
  })

  it('saveState returns false when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(saveState(emptyState())).toBe(false)
  })
})
