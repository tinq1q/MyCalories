import type { Product } from './types'

export function normalizeQuery(s: string): string {
  return s.trim().toLowerCase().replace(/ё/g, 'е')
}

// Word-start matches first, then other substring matches; alphabetical within groups.
export function searchLocal(products: Product[], q: string, limit = 20): Product[] {
  const query = normalizeQuery(q)
  if (!query) return []
  const starts: Product[] = []
  const inside: Product[] = []
  for (const p of products) {
    const name = normalizeQuery(p.name)
    if (!name.includes(query)) continue
    const words = name.split(/[^\p{L}\p{N}]+/u)
    if (words.some((w) => w.startsWith(query))) starts.push(p)
    else inside.push(p)
  }
  const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, 'ru')
  return [...starts.sort(byName), ...inside.sort(byName)].slice(0, limit)
}
