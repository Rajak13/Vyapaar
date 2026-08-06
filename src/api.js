/**
 * Central API fetcher + TanStack Query key definitions.
 * All pages import their query keys and fetcher from here.
 *
 * Auth relies entirely on the httpOnly cookie (`credentials: 'include'`).
 * The Vercel rewrite in vercel.json proxies /auth/* and /api/* to Render,
 * making all requests same-origin — so cookies are sent reliably on all
 * browsers including iOS Safari.
 */

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

/**
 * Returns headers with Authorization: Bearer <token> if a token exists in localStorage.
 * Import and use this in every raw fetch() call so iOS Safari (which blocks cross-origin
 * cookies via ITP) can still authenticate via the Bearer token fallback.
 */
export function getAuthHeaders(extra = {}) {
  const rawToken = localStorage.getItem('vyapaaar_token')
  const token = (rawToken && rawToken !== 'undefined' && rawToken !== 'null') ? rawToken : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(json.error ?? `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return json
}

// ─── Query keys ────────────────────────────────────────────────────────────────
// Centralised so invalidation never has a typo.

export const Q = {
  stats:           () => ['stats'],
  recentEntries:   () => ['entries', 'recent'],
  supplierBals:    () => ['suppliers', 'balances'],
  suppliers:       () => ['suppliers', 'list'],
  entries:         (p) => ['entries', 'page', p],   // p = URLSearchParams string
  payments:        (p) => ['payments', 'list', p],  // p = supplier_id filter
  paymentStats:    () => ['payments', 'stats'],
  fiscalPeriods:   () => ['fiscal-periods'],
  businessProfile: () => ['business-profile'],
  charts:          () => ['dashboard', 'charts'],
}

// ─── Fetchers ──────────────────────────────────────────────────────────────────

export const fetchStats           = () => apiFetch('/api/purchase-entries/stats')
export const fetchRecentEntries   = () => apiFetch('/api/purchase-entries?limit=5')
export const fetchSupplierBals    = () => apiFetch('/api/suppliers/balances')
export const fetchSupplierList    = () => apiFetch('/api/suppliers')
export const fetchEntries         = (params) => apiFetch(`/api/purchase-entries?${params}`)
export const fetchPayments        = (params) => apiFetch(`/api/supplier-payments?${params}`)
export const fetchPaymentStats    = () => apiFetch('/api/supplier-payments/stats')
export const fetchFiscalPeriods   = () => apiFetch('/api/fiscal-periods')
export const fetchBusinessProfile = () => apiFetch('/api/settings/business-profile')
export const fetchCharts          = () => apiFetch('/api/dashboard/charts')
