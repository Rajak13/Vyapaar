/**
 * Simple in-memory API cache with stale-while-revalidate.
 *
 * How it works:
 *  - First visit to a page: fetches, stores result in cache, sets state.
 *  - Navigating away and back: returns cache immediately (instant render),
 *    then silently re-fetches in background to keep data fresh.
 *  - Cache entries expire after `TTL_MS` (default 60s) — after that a
 *    foreground fetch happens again.
 *
 * Usage:
 *   import { cachedFetch, invalidateCache } from './apiCache'
 *
 *   // In a component:
 *   const { data, loading, error, refresh } = useCachedFetch('/api/suppliers/balances')
 *
 *   // After a mutation, invalidate so next navigation re-fetches fresh:
 *   invalidateCache('/api/suppliers/balances')
 */

const cache   = new Map()  // url → { data, ts }
const TTL_MS  = 60_000     // 60 seconds before a foreground refresh

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

function fullUrl(path) {
  return path.startsWith('http') ? path : `${API_URL}${path}`
}

/** Raw fetch wrapper with credentials */
export async function apiFetch(path, options = {}) {
  const res = await fetch(fullUrl(path), {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json
}

/** Check if a cached entry is still fresh */
function isFresh(entry) {
  return entry && Date.now() - entry.ts < TTL_MS
}

/**
 * Fetch with cache. Returns cached data immediately if available,
 * then refreshes in background if stale.
 *
 * @param {string} path  - API path e.g. '/api/suppliers/balances'
 * @param {object} opts  - fetch options
 * @returns {{ data, fromCache }} - data + whether it came from cache
 */
export async function cachedFetch(path, opts = {}) {
  const key   = fullUrl(path)
  const entry  = cache.get(key)

  // Cache hit — return immediately
  if (entry) {
    // If stale, kick off a background refresh (fire-and-forget)
    if (!isFresh(entry)) {
      fetch(key, { credentials: 'include', ...opts })
        .then(r => r.json())
        .then(data => cache.set(key, { data, ts: Date.now() }))
        .catch(() => {})
    }
    return { data: entry.data, fromCache: true }
  }

  // Cache miss — foreground fetch
  const res  = await fetch(key, { credentials: 'include', ...opts })
  const data = await res.json()
  if (res.ok) cache.set(key, { data, ts: Date.now() })
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return { data, fromCache: false }
}

/** Manually remove one or more cache entries (call after mutations) */
export function invalidateCache(...paths) {
  for (const path of paths) {
    cache.delete(fullUrl(path))
    // Also delete any key that starts with this prefix (for paginated endpoints)
    for (const key of cache.keys()) {
      if (key.startsWith(fullUrl(path))) cache.delete(key)
    }
  }
}

/** Invalidate everything */
export function clearCache() {
  cache.clear()
}

// ─── React hook ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * useCachedFetch — drop-in replacement for useEffect+fetch patterns.
 *
 * @param {string|null} path - API path, or null to skip fetching
 * @param {object}      opts - fetch options
 * @returns {{ data, loading, error, refresh }}
 */
export function useCachedFetch(path, opts = {}) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const abortRef              = useRef(null)

  const load = useCallback(async (forceRefresh = false) => {
    if (!path) { setLoading(false); return }

    // If we already have cached data, show it immediately (loading stays false)
    const key   = fullUrl(path)
    const entry  = cache.get(key)
    if (entry && !forceRefresh) {
      setData(entry.data)
      setLoading(false)
      // Background refresh if stale
      if (!isFresh(entry)) {
        fetch(key, { credentials: 'include' })
          .then(r => r.json())
          .then(fresh => {
            cache.set(key, { data: fresh, ts: Date.now() })
            setData(fresh)
          })
          .catch(() => {})
      }
      return
    }

    // No cache — show loading spinner
    setLoading(true)
    setError(null)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res  = await fetch(key, { credentials: 'include', signal: controller.signal, ...opts })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      cache.set(key, { data: json, ts: Date.now() })
      setData(json)
      setError(null)
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [load])

  const refresh = useCallback(() => {
    invalidateCache(path)
    load(true)
  }, [path, load])

  return { data, loading, error, refresh }
}
