// Types mirror the backend JSON exactly (camelCase).

export type Meal = 'breakfast' | 'lunch' | 'snack' | 'dinner'

// Display order matters: the diary renders meals in this order.
export const MEALS: Meal[] = ['breakfast', 'lunch', 'snack', 'dinner']

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  snack: 'Перекус',
  dinner: 'Ужин',
}

export type Sex = 'male' | 'female'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'high' | 'extreme'
export type Goal = 'lose' | 'keep' | 'gain'

export interface Product {
  id: string
  name: string
  // Nutrients per 100 g
  kcal: number
  protein: number
  fat: number
  carbs: number
  portionG: number | null
  source: 'base' | 'off' | 'custom'
}

export interface Entry {
  id: string
  date: string // local day key, YYYY-MM-DD
  meal: Meal
  product: Product
  grams: number
}

export interface Profile {
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activity: Activity
  goal: Goal
  trackWeight: boolean
  updatedAt: string
}

export interface Norm {
  kcal: number
  protein: number
  fat: number
  carbs: number
}

export interface NormRecord extends Norm {
  effectiveFrom: string
  manual: boolean
}

export interface WeightRecord {
  date: string
  weightKg: number
}

export interface ExportData {
  formatVersion: 1
  profile: Profile | null
  normHistory: NormRecord[]
  entries: Entry[]
  customProducts: Product[]
  weights: WeightRecord[]
}

export type DiaryState = ExportData & {
  recentProducts: Product[]
  lastExportAt: string | null
}
