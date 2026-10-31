import type { DiaryState, ExportData } from './types'

function unionById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const seen = new Set(current.map((x) => x.id))
  return [...current, ...incoming.filter((x) => !seen.has(x.id))]
}

// Merge by date; incoming wins on conflict. Sorted ascending.
function mergeWeights(current: DiaryState['weights'], incoming: DiaryState['weights']) {
  const byDate = new Map(current.map((w) => [w.date, w]))
  for (const w of incoming) byDate.set(w.date, w)
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

// Entries and custom products are unioned by id (existing never overwritten),
// weights by date. Profile and norm history travel together from whichever
// side has the newer profile, so they never end up inconsistent.
export function mergeDiary(current: DiaryState, incoming: ExportData): DiaryState {
  const cur = current.profile
  const inc = incoming.profile
  const takeIncoming = inc !== null && (cur === null || inc.updatedAt > cur.updatedAt)
  return {
    ...current,
    profile: takeIncoming ? inc : cur,
    normHistory: takeIncoming ? incoming.normHistory : current.normHistory,
    entries: unionById(current.entries, incoming.entries),
    customProducts: unionById(current.customProducts, incoming.customProducts),
    weights: mergeWeights(current.weights, incoming.weights),
  }
}

export function replaceDiary(current: DiaryState, incoming: ExportData): DiaryState {
  return {
    formatVersion: 1,
    profile: incoming.profile,
    normHistory: incoming.normHistory,
    entries: incoming.entries,
    customProducts: incoming.customProducts,
    weights: incoming.weights,
    recentProducts: current.recentProducts,
    lastExportAt: current.lastExportAt,
  }
}
