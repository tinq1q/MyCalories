import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExportData, Product } from '../domain/types'
import { api, ApiError, BASE_CACHE_KEY } from './client'

const p: Product = { id: 'b1', name: 'Гречка варёная', kcal: 110, protein: 4.2, fat: 1.1, carbs: 21.3, portionG: null, source: 'base' }
const DAY = 24 * 3600 * 1000

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  localStorage.clear()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getBaseProducts', () => {
  it('fetches and caches with a date', async () => {
    fetchMock.mockResolvedValue(respond([p]))
    expect(await api.getBaseProducts()).toEqual([p])
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8000/api/products/base')
    const cached = JSON.parse(localStorage.getItem(BASE_CACHE_KEY)!)
    expect(cached.products).toEqual([p])
    expect(typeof cached.fetchedAt).toBe('number')
  })

  it('uses a fresh cache without fetching', async () => {
    localStorage.setItem(BASE_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now() - 6 * DAY, products: [p] }))
    expect(await api.getBaseProducts()).toEqual([p])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refreshes a cache older than 7 days', async () => {
    const fresh = { ...p, id: 'b2' }
    localStorage.setItem(BASE_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now() - 8 * DAY, products: [p] }))
    fetchMock.mockResolvedValue(respond([fresh]))
    expect(await api.getBaseProducts()).toEqual([fresh])
  })

  it('falls back to a stale cache when the network fails', async () => {
    localStorage.setItem(BASE_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now() - 30 * DAY, products: [p] }))
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await api.getBaseProducts()).toEqual([p])
  })

  it('throws ApiError(network) with no cache and no network', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(api.getBaseProducts()).rejects.toMatchObject({ kind: 'network' })
  })
})

describe('offSearch', () => {
  it('returns products and encodes the query', async () => {
    fetchMock.mockResolvedValue(respond([p]))
    expect(await api.offSearch('греч ка')).toEqual([p])
    expect(fetchMock.mock.calls[0][0]).toBe(`http://localhost:8000/api/products/off-search?q=${encodeURIComponent('греч ка')}`)
  })

  it('maps 503 to ApiError(unavailable)', async () => {
    fetchMock.mockResolvedValue(respond({ detail: 'off_unavailable' }, 503))
    await expect(api.offSearch('x1')).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('maps fetch failure to ApiError(network)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const err = await api.offSearch('x1').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.kind).toBe('network')
  })

  it('lets aborts through unchanged', async () => {
    const abort = new DOMException('aborted', 'AbortError')
    fetchMock.mockRejectedValue(abort)
    await expect(api.offSearch('x1')).rejects.toBe(abort)
  })
})

describe('exportDiary / importDiary', () => {
  const data: ExportData = { formatVersion: 1, profile: null, normHistory: [], entries: [], customProducts: [], weights: [] }

  it('posts JSON and returns the xlsx blob', async () => {
    // jsdom's Blob does not round-trip through Response, so hand back a minimal response object.
    const xlsx = new Blob(['xlsx-bytes'])
    fetchMock.mockResolvedValue({ ok: true, status: 200, blob: async () => xlsx })
    const blob = await api.exportDiary(data)
    expect(blob).toBe(xlsx)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8000/api/diary/export')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual(data)
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('export failure becomes ApiError', async () => {
    fetchMock.mockResolvedValue(respond({ detail: 'boom' }, 500))
    await expect(api.exportDiary(data)).rejects.toBeInstanceOf(ApiError)
  })

  it('uploads the file as multipart field "file" and returns the result', async () => {
    const result = { data, errors: [{ sheet: 'Дневник', row: 3, message: 'bad' }] }
    fetchMock.mockResolvedValue(respond(result))
    const file = new File(['abc'], 'diary.xlsx')
    expect(await api.importDiary(file)).toEqual(result)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8000/api/diary/import')
    expect(init.method).toBe('POST')
    expect((init.body as FormData).get('file')).toBeInstanceOf(File)
  })

  it('400 carries the backend message', async () => {
    fetchMock.mockResolvedValue(respond({ detail: 'Неподдерживаемый файл' }, 400))
    await expect(api.importDiary(new File(['x'], 'a.txt'))).rejects.toMatchObject({
      kind: 'bad-file',
      message: 'Неподдерживаемый файл',
    })
  })

  it('network failure on import', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(api.importDiary(new File(['x'], 'a.xlsx'))).rejects.toMatchObject({ kind: 'network' })
  })
})
