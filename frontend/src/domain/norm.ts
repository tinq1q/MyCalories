import type { Activity, Goal, Norm, NormRecord, Profile } from './types'

export const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  extreme: 1.9,
}

const GOAL_FACTOR: Record<Goal, number> = { lose: 0.85, keep: 1, gain: 1.12 }
const PROTEIN_PER_KG: Record<Goal, number> = { lose: 2.0, keep: 1.6, gain: 1.8 }
const FAT_PER_KG = 0.9

// Mifflin-St Jeor BMR x activity x goal; macros derived from body weight.
export function calcNorm(p: Profile): Norm {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161)
  const kcal = Math.round(bmr * ACTIVITY_FACTOR[p.activity] * GOAL_FACTOR[p.goal])
  const protein = Math.round(PROTEIN_PER_KG[p.goal] * p.weightKg)
  const fat = Math.round(FAT_PER_KG * p.weightKg)
  // Carbs fill the remaining calories (4 kcal/g protein and carbs, 9 kcal/g fat).
  const carbs = Math.round(Math.max(0, (kcal - 4 * protein - 9 * fat) / 4))
  return { kcal, protein, fat, carbs }
}

// The norm in force on `day`: latest record with effectiveFrom <= day.
// Day keys are YYYY-MM-DD, so string comparison is chronological.
export function normForDate(history: NormRecord[], day: string): Norm | null {
  let best: NormRecord | null = null
  for (const r of history) {
    if (r.effectiveFrom <= day && (!best || r.effectiveFrom > best.effectiveFrom)) best = r
  }
  return best && { kcal: best.kcal, protein: best.protein, fat: best.fat, carbs: best.carbs }
}
