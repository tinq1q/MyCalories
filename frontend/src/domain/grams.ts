export const MIN_GRAMS = 1
export const MAX_GRAMS = 5000

// Accepts "150", "150.5" and "150,5". Null for empty / non-numeric / <= 0;
// values above the limit are clamped to it.
export function parseGrams(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(Math.max(n, MIN_GRAMS), MAX_GRAMS)
}
