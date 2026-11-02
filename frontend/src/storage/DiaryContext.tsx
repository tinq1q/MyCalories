import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { todayKey } from '../domain/dates'
import type { DiaryState, Entry, ExportData, Norm, Product, Profile, ThemeId, WeightRecord } from '../domain/types'
import { diaryReducer } from './diaryReducer'
import { STORAGE_KEY, loadState, parseStoredState, saveState } from './storage'
import type { LoadWarning } from './storage'

export interface DiaryApi {
  state: DiaryState
  warning: LoadWarning
  // True while the latest save attempt failed (storage full/unavailable).
  saveFailed: boolean
  // Raw unreadable data when no backup could be written; null otherwise or once discarded.
  corruptRaw: string | null
  // Allow saving over unreadable data that has no backup.
  confirmDiscardCorrupt(): void
  addEntry(e: Omit<Entry, 'id'>): string
  updateEntryGrams(id: string, grams: number): void
  removeEntry(id: string): void
  restoreEntry(e: Entry): void
  addCustomProduct(p: Omit<Product, 'id' | 'source'>): Product
  setProfile(p: Profile): void
  setManualNorm(n: Norm | null): void
  addWeight(w: WeightRecord): void
  setTheme(t: ThemeId): void
  applyImport(data: ExportData, mode: 'merge' | 'replace'): void
  markExported(): void
}

const DiaryContext = createContext<DiaryApi | null>(null)

export function DiaryProvider({ children }: { children: ReactNode }) {
  // Load once; the warning is kept for the UI to show.
  const initial = useRef<ReturnType<typeof loadState> | null>(null)
  if (initial.current === null) initial.current = loadState()
  const [state, dispatch] = useReducer(diaryReducer, initial.current.state)
  const warning = initial.current.warning

  // Persist every change, but never overwrite stored data with the initial
  // (possibly emptied-after-corruption) state before the user changes anything.
  const [saveFailed, setSaveFailed] = useState(false)
  // With no backup of corrupt data, STORAGE_KEY stays untouched until the user confirms.
  const [discarded, setDiscarded] = useState(false)
  const blocked = warning === 'corrupt-no-backup' && !discarded
  const first = useRef(true)
  // The state object last taken from another tab: it is already in storage, so saving it is pointless.
  const reloaded = useRef<DiaryState | null>(null)
  useEffect(() => {
    if (blocked) return
    // After a confirmed discard, save right away (the stored data is being replaced).
    if (first.current && !discarded) {
      first.current = false
      return
    }
    if (state === reloaded.current) return
    setSaveFailed(!saveState(state))
  }, [state, blocked, discarded])

  // Every tab keeps the whole diary in memory and saves all of it on each change.
  // Without this, a tab left open in the background would overwrite entries added
  // in another tab with its stale copy. The browser fires `storage` only in the
  // *other* tabs, so we adopt their saved state before making our own next change.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || e.newValue === null) return
      const next = parseStoredState(e.newValue)
      // Unreadable data is never adopted: that would empty this tab's diary.
      if (next === null) return
      reloaded.current = next
      dispatch({ type: 'reload', state: next })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  const confirmDiscardCorrupt = useCallback(() => setDiscarded(true), [])

  const addEntry = useCallback((e: Omit<Entry, 'id'>) => {
    const id = crypto.randomUUID()
    dispatch({ type: 'addEntry', entry: { ...e, id } })
    return id
  }, [])
  const addCustomProduct = useCallback((p: Omit<Product, 'id' | 'source'>) => {
    const product: Product = { ...p, id: `custom-${crypto.randomUUID()}`, source: 'custom' }
    dispatch({ type: 'addCustomProduct', product })
    return product
  }, [])

  const api = useMemo<DiaryApi>(
    () => ({
      state,
      warning,
      saveFailed,
      corruptRaw: blocked ? (initial.current?.corruptRaw ?? null) : null,
      confirmDiscardCorrupt,
      addEntry,
      addCustomProduct,
      updateEntryGrams: (id, grams) => dispatch({ type: 'updateEntryGrams', id, grams }),
      removeEntry: (id) => dispatch({ type: 'removeEntry', id }),
      restoreEntry: (entry) => dispatch({ type: 'restoreEntry', entry }),
      setProfile: (profile) =>
        dispatch({ type: 'setProfile', profile, today: todayKey(), now: new Date().toISOString() }),
      setManualNorm: (norm) => dispatch({ type: 'setManualNorm', norm, today: todayKey(), now: new Date().toISOString() }),
      addWeight: (weight) => dispatch({ type: 'addWeight', weight, now: new Date().toISOString() }),
      setTheme: (theme) => dispatch({ type: 'setTheme', theme }),
      applyImport: (data, mode) => dispatch({ type: 'import', data, mode }),
      markExported: () => dispatch({ type: 'markExported', now: new Date().toISOString() }),
    }),
    [state, warning, saveFailed, blocked, confirmDiscardCorrupt, addEntry, addCustomProduct],
  )

  return <DiaryContext.Provider value={api}>{children}</DiaryContext.Provider>
}

export function useDiary(): DiaryApi {
  const ctx = useContext(DiaryContext)
  if (!ctx) throw new Error('useDiary must be used inside DiaryProvider')
  return ctx
}
