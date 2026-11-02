import type { Profile, Sex, WeightRecord } from './types'

// Body mass index: weight / (height, m)².
export function bmi(heightCm: number, weightKg: number): number {
  return weightKg / (heightCm / 100) ** 2
}

// How full the avatar looks: 0 at BMI ≤ 18, 1 at BMI ≥ 36, linear between.
export function fullness(bmi: number): number {
  return Math.min(Math.max((bmi - 18) / 18, 0), 1)
}

// Vertical scale of the figure; 180 cm = 1.
export function heightScale(heightCm: number): number {
  return heightCm / 180
}

// Half-widths of the silhouette in avatar units (see JellyAvatar).
export interface BodyDims {
  shoulder: number
  waist: number
  hip: number
  leg: number
  arm: number
}

// [at fullness 0, growth up to fullness 1]
const SHAPES: Record<Sex, Record<keyof BodyDims, [number, number]>> = {
  male: { shoulder: [31, 12], waist: [20, 30], hip: [25, 20], leg: [12, 9], arm: [9, 6] },
  female: { shoulder: [26, 10], waist: [17, 24], hip: [30, 20], leg: [12, 8], arm: [8, 5] },
}

export function bodyDims(sex: Sex, fullness: number): BodyDims {
  const s = SHAPES[sex]
  const at = ([base, grow]: [number, number]) => base + grow * fullness
  return { shoulder: at(s.shoulder), waist: at(s.waist), hip: at(s.hip), leg: at(s.leg), arm: at(s.arm) }
}

// The weight the goal is measured from: the earliest record, else the profile weight.
export function startWeight(weights: WeightRecord[], profile: Profile): number {
  if (weights.length === 0) return profile.weightKg
  return weights.reduce((a, b) => (b.date < a.date ? b : a)).weightKg
}

// The latest record, else the profile weight.
export function currentWeight(weights: WeightRecord[], profile: Profile): number {
  if (weights.length === 0) return profile.weightKg
  return weights.reduce((a, b) => (b.date > a.date ? b : a)).weightKg
}

export interface GoalProgress {
  ratio: number
  leftKg: number
  reached: boolean
}

// Validated target weight: a finite number, or null (the field is not coerced on load).
export function targetOf(profile: Profile): number | null {
  const t = profile.targetWeightKg
  return typeof t === 'number' && Number.isFinite(t) ? t : null
}

// Progress from the start weight to the target. Null when there is nothing to
// reach: goal "keep", no target, or a target on the wrong side of the start
// (e.g. a stale target after the goal changed).
export function goalProgress(profile: Profile, currentKg: number, startKg: number): GoalProgress | null {
  const target = targetOf(profile)
  if (profile.goal === 'keep' || target === null) return null
  const dir = profile.goal === 'lose' ? -1 : 1
  const total = (target - startKg) * dir
  if (total <= 0) return null
  const done = (currentKg - startKg) * dir
  const reached = done >= total
  return {
    ratio: Math.min(Math.max(done / total, 0), 1),
    leftKg: reached ? 0 : Math.round(Math.abs(currentKg - target) * 10) / 10,
    reached,
  }
}
