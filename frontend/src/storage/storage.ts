import type { DiaryState } from '../domain/types'

export const STORAGE_KEY = 'sitefood:v1'
export const CORRUPT_BACKUP_KEY = 'sitefood:corrupt-backup'

export type LoadWarning = 'corrupt' | 'unavailable' | null

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

export function loadState(): { state: DiaryState; warning: LoadWarning } {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return { state: emptyState(), warning: 'unavailable' }
  }
  if (raw === null) return { state: emptyState(), warning: null }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = undefined
  }
  if (!looksValid(parsed)) {
    // Keep the unreadable data so the user can recover it manually.
    try {
      localStorage.setItem(CORRUPT_BACKUP_KEY, raw)
    } catch {
      /* backup is best-effort */
    }
    return { state: emptyState(), warning: 'corrupt' }
  }
  // Defaults fill fields that older/partial saves may lack.
  return { state: { ...emptyState(), ...parsed } as DiaryState, warning: null }
}

export function saveState(s: DiaryState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    return true
  } catch {
    return false
  }
}
