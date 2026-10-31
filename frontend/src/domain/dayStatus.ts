import type { Norm } from './types'

export type DayStatus = 'ok' | 'over' | 'under' | 'empty'

// 'ok' means within +-10% of the day's norm, inclusive.
// 'logged' = entries exist but there is no norm to compare against.
export function dayStatus(
  kcal: number,
  hasEntries: boolean,
  norm: Norm | null,
): DayStatus | 'logged' {
  if (!hasEntries) return 'empty'
  if (!norm) return 'logged'
  if (kcal > norm.kcal * 1.1) return 'over'
  if (kcal < norm.kcal * 0.9) return 'under'
  return 'ok'
}
