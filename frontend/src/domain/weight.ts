export const MIN_WEIGHT = 30
export const MAX_WEIGHT = 300

// Accepts "79.5" and "79,5". Null for empty / non-numeric / outside 30-300 kg.
export function parseWeight(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < MIN_WEIGHT || n > MAX_WEIGHT) return null
  return n
}
