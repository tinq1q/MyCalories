import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { normalizeQuery, searchLocal } from '../domain/search'
import type { Product } from '../domain/types'
import { useDiary } from '../storage/DiaryContext'

export type RemoteState = 'idle' | 'loading' | 'slow' | 'error'

const DEBOUNCE_MS = 400
const SLOW_MS = 5000
const MIN_REMOTE_CHARS = 2

export function useProductSearch(q: string): { local: Product[]; remote: Product[]; remoteState: RemoteState } {
  const { state } = useDiary()
  const [base, setBase] = useState<Product[]>([])
  const [remote, setRemote] = useState<Product[]>([])
  const [remoteState, setRemoteState] = useState<RemoteState>('idle')

  // The base list is cached by the client; without it, local search still covers recent + custom.
  useEffect(() => {
    let alive = true
    api.getBaseProducts().then(
      (p) => alive && setBase(p),
      () => {},
    )
    return () => {
      alive = false
    }
  }, [])

  const { recentProducts, customProducts } = state
  const local = useMemo(() => {
    const seen = new Set<string>()
    const all: Product[] = []
    // Recent first so a product the user actually used wins over its base twin.
    for (const p of [...recentProducts, ...customProducts, ...base]) {
      if (!seen.has(p.id)) {
        seen.add(p.id)
        all.push(p)
      }
    }
    return searchLocal(all, q)
  }, [recentProducts, customProducts, base, q])

  const query = q.trim()
  const enough = normalizeQuery(query).length >= MIN_REMOTE_CHARS
  useEffect(() => {
    setRemote([])
    if (!enough) {
      setRemoteState('idle')
      return
    }
    setRemoteState('loading')
    const ctrl = new AbortController()
    // "slow" counts from the moment the user stopped changing the query's identity (typing).
    const slow = setTimeout(() => setRemoteState((s) => (s === 'loading' ? 'slow' : s)), SLOW_MS)
    const debounce = setTimeout(() => {
      api.offSearch(query, ctrl.signal).then(
        (r) => {
          if (ctrl.signal.aborted) return
          setRemote(r)
          setRemoteState('idle')
        },
        () => {
          if (!ctrl.signal.aborted) setRemoteState('error')
        },
      )
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(debounce)
      clearTimeout(slow)
      ctrl.abort()
    }
  }, [query, enough])

  return { local, remote, remoteState }
}
