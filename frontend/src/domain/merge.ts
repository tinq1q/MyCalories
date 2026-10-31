import type { DiaryState, ExportData, NormRecord } from './types'

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

// Union by effectiveFrom, ascending; on a date clash the fresher side's record wins.
function mergeNorms(stale: NormRecord[], fresh: NormRecord[]): NormRecord[] {
  const byDate = new Map(stale.map((r) => [r.effectiveFrom, r]))
  for (const r of fresh) byDate.set(r.effectiveFrom, r)
  return [...byDate.values()].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
}

// Entries and custom products are unioned by id (existing never overwritten),
// weights by date, norm history by effectiveFrom. The profile comes whole
// from the side with the newer updatedAt.
export function mergeDiary(current: DiaryState, incoming: ExportData): DiaryState {
  const cur = current.profile
  const inc = incoming.profile
  const takeIncoming = inc !== null && (cur === null || inc.updatedAt > cur.updatedAt)
  return {
    ...current,
    profile: takeIncoming ? inc : cur,
    normHistory: takeIncoming
      ? mergeNorms(current.normHistory, incoming.normHistory)
      : mergeNorms(incoming.normHistory, current.normHistory),
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
