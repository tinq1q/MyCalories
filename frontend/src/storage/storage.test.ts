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

  it('reports corrupt-no-backup with raw data when the backup write fails', () => {
    localStorage.setItem(STORAGE_KEY, '{oops')
    const orig = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === 'sitefood:corrupt-backup') throw new Error('quota')
      return orig.call(this, k, v)
    })
    const r = loadState()
    expect(r.warning).toBe('corrupt-no-backup')
    expect(r.corruptRaw).toBe('{oops')
    expect(r.state).toEqual(emptyState())
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

describe('loadState shape coercion', () => {
  it('replaces wrongly typed optional fields with defaults instead of keeping them', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...emptyState(),
      entries: [],
      recentProducts: 'oops',
      lastExportAt: 12345,
      profile: 'nobody',
    }))
    const r = loadState()
    expect(r.warning).toBeNull()
    expect(r.state.recentProducts).toEqual([])
    expect(r.state.lastExportAt).toBeNull()
    expect(r.state.profile).toBeNull()
  })

  it('missing optional fields get defaults; valid values are kept', () => {
    const { recentProducts: _r, lastExportAt: _l, ...partial } = { ...emptyState(), lastExportAt: 'x' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(partial))
    expect(loadState().state).toEqual(emptyState())
    const ok = { ...emptyState(), lastExportAt: '2026-01-01T00:00:00.000Z' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ok))
    expect(loadState().state).toEqual(ok)
  })

  it('a core list that is not an array still counts as corrupt (backed up, user warned)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...emptyState(), weights: {} }))
    expect(loadState().warning).toBe('corrupt')
  })
})
