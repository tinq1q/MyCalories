import type { Entry, Meal, Norm, Product } from './types'

const round1 = (n: number) => Math.round(n * 10) / 10

// Nutrients for a portion; product values are per 100 g.
export function nutrientsFor(p: Product, grams: number): Norm {
  const k = grams / 100
  return {
    kcal: Math.round(p.kcal * k),
    protein: round1(p.protein * k),
    fat: round1(p.fat * k),
    carbs: round1(p.carbs * k),
  }
}

function sum(entries: Entry[]): Norm {
  const t = { kcal: 0, protein: 0, fat: 0, carbs: 0 }
  for (const e of entries) {
    // Sum the already-rounded per-entry values so totals match what is displayed.
    const n = nutrientsFor(e.product, e.grams)
    t.kcal += n.kcal
    t.protein += n.protein
    t.fat += n.fat
    t.carbs += n.carbs
  }
  return { kcal: t.kcal, protein: round1(t.protein), fat: round1(t.fat), carbs: round1(t.carbs) }
}

export function dayTotals(entries: Entry[], day: string): Norm {
  return sum(entries.filter((e) => e.date === day))
}

export function mealTotals(entries: Entry[], day: string, meal: Meal): Norm {
  return sum(entries.filter((e) => e.date === day && e.meal === meal))
}

export function defaultMeal(d: Date): Meal {
  const h = d.getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 18) return 'snack'
  return 'dinner'
}
