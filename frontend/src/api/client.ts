import { API_URL } from '../config'
import type { ExportData, Product } from '../domain/types'

export const BASE_CACHE_KEY = 'sitefood:base-products'
const BASE_MAX_AGE_MS = 7 * 24 * 3600 * 1000

export type ApiErrorKind = 'unavailable' | 'network' | 'bad-file'

export class ApiError extends Error {
  kind: ApiErrorKind
  constructor(kind: ApiErrorKind, message?: string) {
    super(message ?? kind)
    this.name = 'ApiError'
    this.kind = kind
  }
}

export interface ImportResult {
  data: ExportData
  errors: { sheet: string; row: number; message: string }[]
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'

// fetch wrapper: network failures become ApiError('network'); aborts pass through
// untouched so callers can tell "cancelled" from "failed".
async function request(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, init)
  } catch (e) {
    if (isAbort(e)) throw e
    throw new ApiError('network')
  }
}

interface BaseCache {
  fetchedAt: number
  products: Product[]
}

function readCache(): BaseCache | null {
  try {
    const raw = localStorage.getItem(BASE_CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as BaseCache
    return Array.isArray(c.products) && typeof c.fetchedAt === 'number' ? c : null
  } catch {
    return null
  }
}

async function getBaseProducts(): Promise<Product[]> {
  const cache = readCache()
  if (cache && Date.now() - cache.fetchedAt < BASE_MAX_AGE_MS) return cache.products
  try {
    const res = await request('/api/products/base')
    if (!res.ok) throw new ApiError('network')
    const products = (await res.json()) as Product[]
    try {
      localStorage.setItem(BASE_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), products }))
    } catch {
      // Caching is best effort (storage may be full or unavailable).
    }
    return products
  } catch (e) {
    // A stale cache beats no base at all.
    if (cache) return cache.products
    throw e instanceof ApiError ? e : new ApiError('network')
  }
}

async function offSearch(q: string, signal?: AbortSignal): Promise<Product[]> {
  const res = await request(`/api/products/off-search?q=${encodeURIComponent(q)}`, { signal })
  if (res.status === 503) throw new ApiError('unavailable')
  if (!res.ok) throw new ApiError('network')
  return (await res.json()) as Product[]
}

async function exportDiary(data: ExportData): Promise<Blob> {
  const res = await request('/api/diary/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new ApiError('network')
  return res.blob()
}

async function importDiary(file: File): Promise<ImportResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await request('/api/diary/import', { method: 'POST', body: form })
  if (res.status === 400) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null
    throw new ApiError('bad-file', body?.detail)
  }
  if (!res.ok) throw new ApiError('network')
  return (await res.json()) as ImportResult
}

export const api = { getBaseProducts, offSearch, exportDiary, importDiary }
