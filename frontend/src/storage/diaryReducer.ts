import { mergeDiary, replaceDiary } from '../domain/merge'
import { calcNorm } from '../domain/norm'
import type { DiaryState, Entry, ExportData, Norm, NormRecord, Product, Profile, WeightRecord } from '../domain/types'

export const MAX_RECENT = 20

// Time-dependent values (today, now) arrive in the action so the reducer stays pure.
export type DiaryAction =
  | { type: 'addEntry'; entry: Entry }
  | { type: 'updateEntryGrams'; id: string; grams: number }
  | { type: 'removeEntry'; id: string }
  | { type: 'restoreEntry'; entry: Entry }
  | { type: 'addCustomProduct'; product: Product }
  | { type: 'setProfile'; profile: Profile; today: string; now: string }
  | { type: 'setManualNorm'; norm: Norm | null; today: string; now: string }
  | { type: 'addWeight'; weight: WeightRecord; now: string }
  | { type: 'import'; data: ExportData; mode: 'merge' | 'replace' }
  | { type: 'markExported'; now: string }
  // Replace the whole state with what another browser tab saved.
  | { type: 'reload'; state: DiaryState }

// Add a record; one with the same effectiveFrom is replaced, not duplicated.
function upsertNorm(history: NormRecord[], rec: NormRecord): NormRecord[] {
  return [...history.filter((r) => r.effectiveFrom !== rec.effectiveFrom), rec].sort((a, b) =>
    a.effectiveFrom.localeCompare(b.effectiveFrom),
  )
}

// Any profile/norm change bumps updatedAt so import-merge picks the right side.
function stamp(profile: Profile | null, now: string): Profile | null {
  return profile && { ...profile, updatedAt: now }
}

function lastIsManual(history: NormRecord[]): boolean {
  return history.length > 0 && history[history.length - 1].manual
}

export function diaryReducer(state: DiaryState, action: DiaryAction): DiaryState {
  switch (action.type) {
    case 'addEntry': {
      const p = action.entry.product
      const recentProducts = [p, ...state.recentProducts.filter((r) => r.id !== p.id)].slice(0, MAX_RECENT)
      return { ...state, entries: [...state.entries, action.entry], recentProducts }
    }
    case 'updateEntryGrams':
      return { ...state, entries: state.entries.map((e) => (e.id === action.id ? { ...e, grams: action.grams } : e)) }
    case 'removeEntry':
      return { ...state, entries: state.entries.filter((e) => e.id !== action.id) }
    case 'restoreEntry':
      if (state.entries.some((e) => e.id === action.entry.id)) return state
      return { ...state, entries: [...state.entries, action.entry] }
    case 'addCustomProduct':
      return { ...state, customProducts: [...state.customProducts, action.product] }
    case 'setProfile': {
      const profile = { ...action.profile, updatedAt: action.now }
      // A manual norm stays in force until the user explicitly resets it.
      const normHistory = lastIsManual(state.normHistory)
        ? state.normHistory
        : upsertNorm(state.normHistory, { effectiveFrom: action.today, ...calcNorm(profile), manual: false })
      return { ...state, profile, normHistory }
    }
    case 'setManualNorm': {
      if (action.norm) {
        const rec: NormRecord = { effectiveFrom: action.today, ...action.norm, manual: true }
        return { ...state, profile: stamp(state.profile, action.now), normHistory: upsertNorm(state.normHistory, rec) }
      }
      if (!state.profile) return state
      const rec: NormRecord = { effectiveFrom: action.today, ...calcNorm(state.profile), manual: false }
      return { ...state, profile: stamp(state.profile, action.now), normHistory: upsertNorm(state.normHistory, rec) }
    }
    case 'addWeight': {
      const w = action.weight
      const weights = [...state.weights.filter((x) => x.date !== w.date), w].sort((a, b) => a.date.localeCompare(b.date))
      const latest = weights[weights.length - 1].date === w.date
      // Only the newest weight drives the profile and the norm.
      if (!state.profile || !latest) return { ...state, weights }
      // Stamp updatedAt so merge sees this as a profile change.
      const profile = { ...state.profile, weightKg: w.weightKg, updatedAt: action.now }
      const normHistory = lastIsManual(state.normHistory)
        ? state.normHistory
        : upsertNorm(state.normHistory, { effectiveFrom: w.date, ...calcNorm(profile), manual: false })
      return { ...state, weights, profile, normHistory }
    }
    case 'import':
      return action.mode === 'merge' ? mergeDiary(state, action.data) : replaceDiary(state, action.data)
    case 'markExported':
      return { ...state, lastExportAt: action.now }
    case 'reload':
      return action.state
  }
}
