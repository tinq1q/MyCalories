import type { DiaryState } from '../domain/types'

export const STORAGE_KEY = 'sitefood:v1'
export const CORRUPT_BACKUP_KEY = 'sitefood:corrupt-backup'

export type LoadWarning = 'corrupt' | 'corrupt-no-backup' | 'unavailable' | null

export function emptyState(): DiaryState {
  return {
    formatVersion: 1,
    profile: null,
    normHistory: [],
    entries: [],
    customProducts: [],
    weights: [],
    recentProducts: [],
    lastExportAt: null,
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Minimal shape check: an object whose list fields are arrays.
function looksValid(v: unknown): v is Record<string, unknown> {
  if (!isObject(v)) return false
  return (['entries', 'customProducts', 'normHistory', 'weights'] as const).every((k) => Array.isArray(v[k]))
}

// Parse a stored JSON string into a state, or null when it is unreadable.
// Pure (no storage writes), so it is also safe for data saved by another tab.
export function parseStoredState(raw: string): DiaryState | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!looksValid(parsed)) return null
  // Defaults fill fields that older/partial saves may lack.
  return { ...emptyState(), ...parsed } as DiaryState
}

// `corruptRaw` is set only for 'corrupt-no-backup': the raw data exists nowhere else.
export function loadState(): { state: DiaryState; warning: LoadWarning; corruptRaw?: string } {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return { state: emptyState(), warning: 'unavailable' }
  }
  if (raw === null) return { state: emptyState(), warning: null }

  const state = parseStoredState(raw)
  if (state === null) {
    // Keep the unreadable data so the user can recover it manually.
    try {
      localStorage.setItem(CORRUPT_BACKUP_KEY, raw)
    } catch {
      // Backup failed: the caller must not overwrite STORAGE_KEY until the user agrees.
      return { state: emptyState(), warning: 'corrupt-no-backup', corruptRaw: raw }
    }
    return { state: emptyState(), warning: 'corrupt' }
  }
  return { state, warning: null }
}

export function saveState(s: DiaryState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    return true
  } catch {
    return false
  }
}
