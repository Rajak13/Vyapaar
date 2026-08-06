import { useEffect, useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Q,
  fetchStats, fetchRecentEntries, fetchSupplierBals,
  fetchSupplierList, fetchPaymentStats, fetchPayments, fetchEntries,
  fetchCharts,
} from './api'
import './Dashboard.css'
import PurchaseEntryForm from './PurchaseEntryForm'
import PurchaseRegister from './PurchaseRegister'
import Suppliers from './Suppliers'
import Payments from './Payments'
import Settings from './Settings'
import { adToBs } from './adToBs.js'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')


// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Helpers ─────────────────────────────────────────────────────────────────────
function fmtRs(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return 'Rs. 0'
  return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart helper components ─────────────────────────────────────────────────────

// 1. Monthly bar chart — purchases (orange) + VAT (green) stacked per month
function MonthlyBarChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="bento-chart-body bento-chart-empty">No purchase data yet.</div>
  }
  const maxVal = Math.max(...data.map(d => d.total_purchased), 1)
  const W = 500, H = 140, BAR_W = 28, BOTTOM = 20
  const slotW = W / data.length
  return (
    <div className="bento-chart-body">
      <svg className="bento-svg-chart" viewBox={`0 0 ${W} ${H + BOTTOM}`} preserveAspectRatio="none">
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f} x1="0" y1={H * (1 - f)} x2={W} y2={H * (1 - f)}
            stroke="var(--dash-border)" strokeDasharray="3 3" />
        ))}
        {data.map((d, i) => {
          const cx     = slotW * i + slotW / 2
          const purPct = d.total_purchased / maxVal
          const taxPct = d.total_tax / maxVal
          const purH   = Math.max(purPct * H, 2)
          const taxH   = Math.max(taxPct * H * 0.6, 2)
          const isLast = i === data.length - 1
          return (
            <g key={d.month}>
              <rect x={cx - BAR_W / 2} y={H - purH} width={BAR_W} height={purH}
                rx="4" fill="#E04F16" opacity={isLast ? 1 : 0.75} />
              <rect x={cx - BAR_W / 2} y={H - purH - taxH} width={BAR_W} height={taxH}
                rx="3" fill="#34d399" opacity="0.9" />
              <text x={cx} y={H + 14} textAnchor="middle"
                fill={isLast ? 'var(--df)' : 'var(--dm)'}
                fontWeight={isLast ? 'bold' : 'normal'} fontSize="10">
                {d.month_label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Colour palette for categories / suppliers
const CAT_COLORS = ['#E04F16','#f59e0b','#3b82f6','#10b981','#8b5cf6','#ec4899','#6366f1']

// 2. Account-head (category) breakdown — horizontal bar chart
function AccountHeadBreakdown({ data }) {
  const total = data.reduce((s, d) => s + d.total, 0) || 1
  return (
    <div className="dash-card bento-limit-card">
      <div className="bento-card-title" style={{ marginBottom: 14 }}>Spend by Category</div>
      {data.length === 0
        ? <p style={{ fontSize: 12, color: 'var(--dm)' }}>No categorised entries yet.</p>
        : data.map((d, i) => {
            const pct = Math.round((d.total / total) * 100)
            return (
              <div key={d.category} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--df)' }}>{d.category}</span>
                  <span style={{ fontSize: 11, color: 'var(--dm)' }}>{pct}% · {fmtRs(d.total)}</span>
                </div>
                <div className="dash-progress-track">
                  <div className="dash-progress-bar"
                    style={{ width: `${pct}%`, background: CAT_COLORS[i % CAT_COLORS.length] }} />
                </div>
              </div>
            )
          })
      }
    </div>
  )
}

// 3. Payment method split — pill badges + mini bars
function PaymentMethodSplit({ data }) {
  const total = data.reduce((s, d) => s + d.total, 0) || 1
  const METHOD_LABELS = { cash: 'Cash', online: 'Online', cheque: 'Cheque' }
  const METHOD_COLORS = { cash: '#10b981', online: '#3b82f6', cheque: '#f59e0b' }
  return (
    <div className="dash-card bento-tip-card" style={{ justifyContent: 'flex-start', gap: 16 }}>
      <div className="bento-card-title">Payment Methods</div>
      {data.length === 0
        ? <p style={{ fontSize: 12, color: 'var(--dm)' }}>No payments recorded yet.</p>
        : <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              {data.map(d => (
                <span key={d.method} style={{
                  padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                  background: `${METHOD_COLORS[d.method] ?? '#888'}22`,
                  color: METHOD_COLORS[d.method] ?? '#888',
                  border: `1.5px solid ${METHOD_COLORS[d.method] ?? '#888'}`,
                }}>
                  {METHOD_LABELS[d.method] ?? d.method} — {Math.round((d.total / total) * 100)}%
                </span>
              ))}
            </div>
            {data.map((d, i) => {
              const pct = Math.round((d.total / total) * 100)
              return (
                <div key={d.method} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--df)' }}>
                      {METHOD_LABELS[d.method] ?? d.method}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--dm)' }}>{fmtRs(d.total)}</span>
                  </div>
                  <div className="dash-progress-track">
                    <div className="dash-progress-bar"
                      style={{ width: `${pct}%`, background: METHOD_COLORS[d.method] ?? '#888' }} />
                  </div>
                </div>
              )
            })}
          </>
      }
    </div>
  )
}

// 4. Top 5 suppliers — horizontal bars
function TopSuppliersChart({ data, onNav }) {
  const max = Math.max(...data.map(d => d.total_purchased), 1)
  return (
    <div className="dash-card bento-cost-card">
      <div className="bento-card-header" style={{ marginBottom: 14 }}>
        <div>
          <div className="bento-card-title">Top Suppliers</div>
          <div className="bento-card-sub">By total purchases</div>
        </div>
        <button onClick={onNav} style={{
          background: 'none', border: 'none', color: 'var(--orange)',
          fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}>View all →</button>
      </div>
      {data.length === 0
        ? <p style={{ fontSize: 12, color: 'var(--dm)' }}>No supplier data yet.</p>
        : data.map((d, i) => {
            const pct = Math.round((d.total_purchased / max) * 100)
            return (
              <div key={d.supplier_name} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--df)',
                    maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.supplier_name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--dm)' }}>{fmtRs(d.total_purchased)}</span>
                </div>
                <div className="dash-progress-track">
                  <div className="dash-progress-bar"
                    style={{ width: `${pct}%`, background: CAT_COLORS[i % CAT_COLORS.length] }} />
                </div>
              </div>
            )
          })
      }
    </div>
  )
}

// 5. Entry paid-status donut (SVG arc)
function EntryStatusDonut({ data, onNav }) {
  const map = { paid: 0, partial: 0, pending: 0 }
  data.forEach(d => { map[d.status] = d.count })
  const total = map.paid + map.partial + map.pending || 1
  const paidPct = map.paid / total

  // SVG arc helper
  function arc(startPct, endPct, r, cx, cy) {
    const a1 = (startPct * 2 * Math.PI) - Math.PI / 2
    const a2 = (endPct   * 2 * Math.PI) - Math.PI / 2
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2)
    const large = endPct - startPct > 0.5 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }

  const partialPct = map.partial / total
  const pendingPct = map.pending / total
  const segs = [
    { pct: paidPct,    color: '#10b981', label: 'Paid'    },
    { pct: partialPct, color: '#f59e0b', label: 'Partial' },
    { pct: pendingPct, color: '#8A8578', label: 'Pending' },
  ]
  let cursor = 0

  return (
    <div className="dash-card bento-gauge-card">
      <div className="bento-card-header" style={{ marginBottom: 8 }}>
        <div>
          <div className="bento-card-title">Invoice Status</div>
          <div className="bento-card-sub">{total} total entries</div>
        </div>
        <button onClick={onNav} style={{
          background: 'none', border: 'none', color: 'var(--orange)',
          fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}>View →</button>
      </div>
      <div className="bento-gauge-body">
        <svg viewBox="0 0 120 120" width="120" height="120">
          {segs.map(seg => {
            if (seg.pct <= 0) { cursor += seg.pct; return null }
            const d = arc(cursor, cursor + seg.pct, 46, 60, 60)
            cursor += seg.pct
            return <path key={seg.label} d={d} fill="none"
              stroke={seg.color} strokeWidth="16" strokeLinecap="butt" />
          })}
          <text x="60" y="56" textAnchor="middle" fill="var(--df)" fontSize="18" fontWeight="bold">
            {Math.round(paidPct * 100)}%
          </text>
          <text x="60" y="70" textAnchor="middle" fill="var(--dm)" fontSize="9">paid</text>
        </svg>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 4 }}>
        {segs.map(seg => (
          <span key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--df)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
            {seg.label}: {map[seg.label.toLowerCase()]}
          </span>
        ))}
      </div>
    </div>
  )
}

// 6. Tax vs Purchases — last 6 months dual mini-line sparkline
function TaxVsPurchases({ data }) {
  const slice = data.slice(-6)
  if (slice.length < 2) {
    return (
      <div className="dash-card bento-goal-card">
        <div className="bento-card-title" style={{ marginBottom: 8 }}>Tax vs Purchases</div>
        <p style={{ fontSize: 12, color: 'var(--dm)' }}>Need at least 2 months of data.</p>
      </div>
    )
  }
  const maxP = Math.max(...slice.map(d => d.total_purchased), 1)
  const W = 200, H = 80
  const xStep = W / (slice.length - 1)

  function points(key, max) {
    return slice.map((d, i) => `${i * xStep},${H - (d[key] / max) * H}`).join(' ')
  }

  return (
    <div className="dash-card bento-goal-card">
      <div className="bento-card-header" style={{ marginBottom: 10 }}>
        <div className="bento-card-title">Tax vs Purchases</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: 'visible' }}>
        <polyline points={points('total_purchased', maxP)}
          fill="none" stroke="#E04F16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={points('total_tax', maxP)}
          fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        {slice.map(d => (
          <span key={d.month} style={{ fontSize: 10, color: 'var(--dm)' }}>{d.month_label}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <span style={{ fontSize: 11, color: '#E04F16', fontWeight: 600 }}>● Purchases</span>
        <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>● VAT</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons ───────────────────────────────────────────────────────────────────────
function SunIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" strokeLinecap="round"/></svg>
}
function MoonIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/></svg>
}
function SearchIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
}
function LogoutIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}
function CalendarIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
}
function ArrowIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
}
function ChevronIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
}
function PlusIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>
}
function ShoppingIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.6-8M7 13l-2.3 2.3c-.6.6-.2 1.7.7 1.7H17"/><circle cx="17" cy="19" r="2"/><circle cx="9" cy="19" r="2"/></svg>
}
function CashIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
}
function SuppliersIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function UsersIcon() {
  return <SuppliersIcon />
}
function OverviewIcon() {
  return <svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
}
function RegisterIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
}
function SuppliersNavIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
}
function PaymentsNavIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/><path d="M6 12H4M20 12h-2"/></svg>
}
function SettingsIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard({ user: initialUser, theme, onThemeChange, onLogout, onToast }) {
  const [user, setUser]                   = useState(initialUser)
  const [activeNav, setActiveNav]         = useState(
    () => sessionStorage.getItem('vyapaar_nav') ?? 'overview'
  )
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [searchQuery,   setSearchQuery]   = useState('')
  // Counters incremented by the mobile FAB — each child watches its own counter
  const [payFormCount,  setPayFormCount]  = useState(0)
  const [supFormCount,  setSupFormCount]  = useState(0)
  // Action sheet for the mobile centre FAB
  const [showFabMenu,   setShowFabMenu]   = useState(false)

  const qc = useQueryClient()

  // ── Invalidate + refetch everything after mutations ───────────────────────
  const triggerRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: Q.stats() })
    qc.invalidateQueries({ queryKey: Q.recentEntries() })
    qc.invalidateQueries({ queryKey: Q.supplierBals() })
    qc.invalidateQueries({ queryKey: Q.suppliers() })
    qc.invalidateQueries({ queryKey: Q.payments('') })
    qc.invalidateQueries({ queryKey: Q.paymentStats() })
    // Also nuke the paginated entries cache
    qc.invalidateQueries({ queryKey: ['entries'] })
  }, [qc])

  // ── Bento Grid Period State ────────────────────────────────────────────────
  const [chartPeriod, setChartPeriod] = useState('7d')

  // ── Fetch overview data via React Query ───────────────────────────────────
  const isAuth = Boolean(user)
  const { data: statsData,    isLoading: loadingStats    } = useQuery({ queryKey: Q.stats(),         queryFn: fetchStats,         enabled: isAuth })
  const { data: entriesData,  isLoading: loadingEntries  } = useQuery({ queryKey: Q.recentEntries(), queryFn: fetchRecentEntries, enabled: isAuth })
  const { data: balancesData, isLoading: loadingBalances } = useQuery({ queryKey: Q.supplierBals(),  queryFn: fetchSupplierBals,  enabled: isAuth })
  const { data: chartsData                               } = useQuery({ queryKey: Q.charts(),        queryFn: fetchCharts,        enabled: isAuth })

  const loadingData = loadingStats || loadingEntries || loadingBalances

  // ── Prefetch all other pages after initial mount settles ─────────────────
  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => {
      qc.prefetchQuery({ queryKey: Q.suppliers(),    queryFn: fetchSupplierList })
      qc.prefetchQuery({ queryKey: Q.paymentStats(), queryFn: fetchPaymentStats })
      qc.prefetchQuery({ queryKey: Q.payments('limit=50'), queryFn: () => fetchPayments('limit=50') })
      qc.prefetchQuery({ queryKey: Q.entries('limit=20&offset=0'), queryFn: () => fetchEntries('limit=20&offset=0') })
    }, 1500)
    return () => clearTimeout(timer)
  }, [user])

  // ── Derive overview values from query data ────────────────────────────────
  const stats = {
    totalPurchasesFY:  statsData?.totalPurchasesFY  ?? 0,
    activeSuppliers:   statsData?.activeSuppliers   ?? 0,
    pendingPayments:   balancesData?.suppliers
      ? balancesData.suppliers.reduce((s, sup) => s + Math.max(0, parseFloat(sup.balance_due ?? 0)), 0)
      : 0,
    entriesThisMonth:  statsData?.entriesThisMonth  ?? 0,
    taxTotal:          statsData?.taxTotal           ?? 0,
    fiscal:            statsData?.fiscal             ?? null,
  }

  const entries      = entriesData?.entries ?? []
  const entriesTotal = entriesData?.total   ?? 0

  const supplierBalances = (() => {
    if (!balancesData?.suppliers) return []
    const sorted = [...balancesData.suppliers]
      .filter(s => parseFloat(s.total_purchased) > 0)
      .sort((a, b) => parseFloat(b.total_purchased) - parseFloat(a.total_purchased))
      .slice(0, 5)
    const maxAmt = parseFloat(sorted[0]?.total_purchased ?? 0)
    return sorted.map(s => ({
      name:    s.supplier_name,
      amount:  fmtRs(s.total_purchased),
      pct:     maxAmt > 0 ? Math.round((parseFloat(s.total_purchased) / maxAmt) * 100) : 0,
      initial: s.supplier_name?.[0]?.toUpperCase() ?? '?',
    }))
  })()

  // Sync user state when prop changes
  useEffect(() => { setUser(initialUser) }, [initialUser])

  const fullName = user?.full_name ?? ''
  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const today   = new Date()
  const dayNum  = today.getDate()
  const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][today.getDay()]
  const monName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][today.getMonth()]

  const NAV_ITEMS = [
    { key: 'overview',  Icon: OverviewIcon,     title: 'Overview'          },
    { key: 'register',  Icon: RegisterIcon,     title: 'Purchase Register' },
    { key: 'suppliers', Icon: SuppliersNavIcon, title: 'Suppliers'         },
    { key: 'payments',  Icon: PaymentsNavIcon,  title: 'Payments'          },
    { key: 'settings',  Icon: SettingsIcon,     title: 'Settings'          },
  ]

  function handleEntrySuccess(msg) {
    setShowEntryForm(false)
    triggerRefresh()
    if (onToast) onToast(msg, 'success')
  }

  function handleNavClick(key) {
    setActiveNav(key)
    sessionStorage.setItem('vyapaar_nav', key)
    // Opening the form directly from the sidebar is removed —
    // the Purchase Register page has its own Add Entry button
  }
  function handleLogout() {
    onLogout();
    sessionStorage.removeItem('vyapaar_nav');
  }

  return (
    <div className={`dash-page app-${theme}`}>
      <div className="dash-container">

        {/* ── Top nav ── */}
        <header className="dash-topnav">
          <div className="dash-topnav-left">
            <div className="dash-brand">
              <div className="dash-brand-icon">V</div>
              <div>
                <div className="dash-brand-name">Vyapaar</div>
                <div className="dash-brand-sub">Dashboard</div>
              </div>
            </div>
          </div>

          <div className="dash-topnav-right">
            {/* Search bar — filters recent entries table; press Enter to go to full register */}
            <div className="dash-search">
              <SearchIcon />
              <input
                type="text"
                placeholder="Search invoices or suppliers…"
                className="dash-search-input"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    handleNavClick('register')
                    setSearchQuery('')
                  }
                }}
              />
              {searchQuery && (
                <button
                  className="dash-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >×</button>
              )}
            </div>

            <div className="dash-theme-toggle" role="group" aria-label="Theme">
              <button className={`dash-toggle-btn${theme === 'light' ? ' active' : ''}`} onClick={() => onThemeChange('light')} aria-label="Light theme"><SunIcon /></button>
              <button className={`dash-toggle-btn${theme === 'dark'  ? ' active' : ''}`} onClick={() => onThemeChange('dark')}  aria-label="Dark theme"><MoonIcon /></button>
            </div>

            {/* Mobile-only single-button theme toggle (shown when the pill above is hidden) */}
            <button
              className="dash-theme-toggle-mobile"
              onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>

            <div className="dash-user-pill">
              <div className="dash-avatar">{fullName[0]?.toUpperCase() ?? '?'}</div>
              <div>
                <div className="dash-user-name">{fullName}</div>
                <div className="dash-user-sub">Admin Account</div>
              </div>
            </div>

            <button className="dash-logout-btn" onClick={handleLogout} aria-label="Log out" title="Log out">
              <LogoutIcon />
            </button>
          </div>
        </header>

        {/* ── Body grid ── */}
        <div className="dash-body">

          {/* Left vertical navigation drawer sidebar */}
          <aside className="dash-sidebar">
            <div className="dash-sidebar-inner">
              <div className="dash-sidebar-section-label">MENU</div>
              {NAV_ITEMS.map(({ key, Icon, title }) => (
                <button
                  key={key}
                  className={`dash-sidebar-btn${activeNav === key ? ' active' : ''}`}
                  onClick={() => handleNavClick(key)}
                  aria-label={title}
                >
                  <div className="dash-sidebar-icon-wrap"><Icon /></div>
                  <span className="dash-sidebar-label">{title}</span>
                  {activeNav === key && <div className="dash-sidebar-active-indicator" />}
                </button>
              ))}

              <div className="dash-sidebar-divider" />

              <div className="dash-sidebar-section-label">ACCOUNT</div>
              <button
                className="dash-sidebar-btn dash-sidebar-btn-logout"
                onClick={handleLogout}
                aria-label="Log out"
              >
                <div className="dash-sidebar-icon-wrap"><LogoutIcon /></div>
                <span className="dash-sidebar-label">Log out</span>
              </button>
            </div>
          </aside>

          {/* Main content — swaps based on active nav */}
          <main className="dash-main" style={{ padding: activeNav !== 'overview' ? 0 : undefined }}>

            {activeNav === 'register' && (
              <PurchaseRegister
                theme={theme}
                onToast={onToast}
              />
            )}

            {activeNav === 'suppliers' && (
              <Suppliers onToast={onToast} openForm={supFormCount} />
            )}

            {activeNav === 'payments' && (
              <Payments onToast={onToast} openForm={payFormCount} />
            )}

            {activeNav === 'settings' && (
              <Settings onToast={onToast} user={user} />
            )}

            {activeNav === 'overview' && (<div className="bento-container">
              <div className="dash-welcome-row">
                <div className="dash-date-card">
                  <span className="dash-date-num">{dayNum}</span>
                  <span className="dash-date-sub">{dayName}, {monName}</span>
                </div>
                <div className="dash-greeting-block">
                  <div className="dash-greeting-line">{greeting},</div>
                  <div className="dash-greeting-name">{fullName}</div>
                </div>
                <div className="dash-header-actions">
                  <button className="dash-action-btn-seal" onClick={() => setShowEntryForm(true)}>+ Add Entry</button>
                  <button className="dash-action-btn-outline" onClick={() => handleNavClick('payments')}>Record Payment</button>
                  <button className="dash-action-btn-outline" onClick={() => handleNavClick('suppliers')}>Add Supplier</button>
                </div>
              </div>

              {/* ── ROW 1: Monthly Purchases Trend + KPI Stack ── */}
              <div className="bento-grid-row-1">
                <div className="dash-card bento-hero-chart">
                  <div className="bento-chart-header">
                    <div>
                      <div className="bento-chart-eyebrow">Monthly Purchases Trend</div>
                      <div className="bento-chart-amount">{fmtRs(stats.totalPurchasesFY)}</div>
                      <div className="bento-chart-sub">Last 8 months — purchases vs VAT</div>
                    </div>
                  </div>
                  <MonthlyBarChart data={chartsData?.monthly ?? []} />
                  <div className="bento-chart-legend">
                    <span className="legend-item"><span className="legend-dot dot-orange" />Purchases</span>
                    <span className="legend-item"><span className="legend-dot dot-green" />VAT (13%)</span>
                  </div>
                </div>

                <div className="bento-metric-stack">
                  <div className="dash-card bento-mini-card" onClick={() => handleNavClick('register')}>
                    <span className="bento-mini-label">Total Purchases (FY)</span>
                    <span className="bento-mini-val">{fmtRs(stats.totalPurchasesFY)}</span>
                    <span className="bento-trend-badge trend-neutral">{stats.entriesThisMonth} entries this month</span>
                  </div>
                  <div className="dash-card bento-mini-card">
                    <span className="bento-mini-label">VAT Collected (13%)</span>
                    <span className="bento-mini-val">{fmtRs(stats.taxTotal)}</span>
                    <span className="bento-trend-badge trend-neutral">
                      {stats.totalPurchasesFY > 0
                        ? `${((stats.taxTotal / stats.totalPurchasesFY) * 100).toFixed(1)}% of total spend`
                        : 'No purchases yet'}
                    </span>
                  </div>
                  <div className="dash-card bento-mini-card" onClick={() => handleNavClick('suppliers')}>
                    <span className="bento-mini-label">Payable Dues</span>
                    <span className="bento-mini-val">{fmtRs(stats.pendingPayments)}</span>
                    <span className="bento-trend-badge trend-warn">Across {stats.activeSuppliers} active parties</span>
                  </div>
                </div>
              </div>

              {/* ── ROW 2: Spend by Category + Payment Method Split ── */}
              <div className="bento-grid-row-2">
                <AccountHeadBreakdown data={chartsData?.accountHeads ?? []} />
                <PaymentMethodSplit   data={chartsData?.paymentMethods ?? []} />
              </div>

              {/* ── ROW 3: Top Suppliers + Entry Status + Tax Trend ── */}
              <div className="bento-grid-row-3">
                <TopSuppliersChart  data={chartsData?.topSuppliers ?? []} onNav={() => handleNavClick('suppliers')} />
                <EntryStatusDonut   data={chartsData?.paidStatus   ?? []} onNav={() => handleNavClick('register')} />
                <TaxVsPurchases     data={chartsData?.monthly      ?? []} />
              </div>
            </div>)}
          </main>

          {/* Right sidebar — Re-organized Vertically */}
          <aside className="dash-right-sidebar">

            {/* 1. Fiscal Period card — real data from stats endpoint */}
            <div className="dash-card">
              <div className="dash-fiscal-header">
                <span className="dash-fiscal-eyebrow">Fiscal Period</span>
                <div className="dash-fiscal-cal-icon"><CalendarIcon /></div>
              </div>
              <div className="dash-fiscal-fy">FY {stats.fiscal?.label ?? '—'}</div>
              <div className="dash-fiscal-range">{stats.fiscal?.range ?? 'Shrawan — Ashad'}</div>
              <div className="dash-fiscal-progress-section">
                <div className="dash-fiscal-progress-label">
                  <span>Progress</span>
                  <span>{stats.fiscal?.progress ?? 0}%</span>
                </div>
                <div className="dash-progress-track">
                  <div className="dash-progress-bar" style={{ width: `${stats.fiscal?.progress ?? 0}%` }} />
                </div>
              </div>
            </div>

            {/* 2. Spend by Supplier — real data from supplier_balances */}
            <div className="dash-card">
              <div className="dash-section-label">Spend by Supplier</div>
              <div className="dash-supplier-list">
                {supplierBalances.length === 0 && !loadingData && (
                  <p style={{ fontSize: 12, color: 'var(--dm)', margin: '8px 0' }}>No purchase data yet.</p>
                )}
                {supplierBalances.map((s, i) => (
                  <div key={i} className="dash-supplier-row">
                    <div className={`dash-supplier-avatar dash-supplier-avatar-${i === 0 ? 'primary' : 'secondary'}`}>{s.initial}</div>
                    <div className="dash-supplier-info">
                      <div className="dash-supplier-name-row">
                        <span className="dash-supplier-name">{s.name}</span>
                        <span className="dash-supplier-amount">{s.amount}</span>
                      </div>
                      <div className="dash-progress-track">
                        <div className="dash-progress-bar" style={{ width: `${s.pct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="dash-manage-suppliers-btn" onClick={() => handleNavClick('suppliers')}>
                Manage All Suppliers
              </button>
            </div>

            {/* 3. Recent Purchase Entries — Compact Transaction History Panel */}
            <div className="dash-card bento-tx-card">
              <div className="dash-table-header" style={{ padding: '0 0 10px 0', borderBottom: '1px solid var(--dash-border)' }}>
                <span className="dash-section-label" style={{ margin: 0 }}>Recent Entries</span>
                <button className="dash-view-all-btn" onClick={() => handleNavClick('register')}>
                  <span>View all →</span>
                </button>
              </div>

              <div className="bento-tx-list">
                {entries.length === 0 && !loadingData && (
                  <p style={{ fontSize: 12, color: 'var(--dm)', margin: '12px 0', textAlign: 'center' }}>No recent entries.</p>
                )}
                {entries.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="bento-tx-row">
                    <div className="bento-tx-left">
                      <div className="bento-tx-avatar">{entry.supplier_name ? entry.supplier_name.charAt(0).toUpperCase() : 'P'}</div>
                      <div className="bento-tx-info">
                        <span className="bento-tx-name">{entry.supplier_name || 'Purchase Entry'}</span>
                        <span className="bento-tx-sub">{entry.invoice_no} • {entry.date_bs || adToBs(entry.date_ad) || ''}</span>
                      </div>
                    </div>
                    <div className="bento-tx-right">
                      <span className="bento-tx-amount">{fmtRs(entry.grand_total)}</span>
                      <span className={`dash-badge dash-badge-${
                        entry.paid_status === 'paid'    ? 'paid' :
                        entry.paid_status === 'partial' ? 'partial' : 'pending'
                      }`}>
                        {entry.paid_status === 'paid' ? 'Paid' : entry.paid_status === 'partial' ? 'Partial' : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </aside>
        </div>

      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="dash-mobile-nav" aria-label="Main navigation">
        <button
          className={`dash-mobile-nav-btn${activeNav === 'overview' ? ' active' : ''}`}
          onClick={() => handleNavClick('overview')}
          aria-label="Home"
        >
          <OverviewIcon />
          <span className="dash-mobile-nav-label">Home</span>
        </button>
        <button
          className={`dash-mobile-nav-btn${activeNav === 'register' ? ' active' : ''}`}
          onClick={() => handleNavClick('register')}
          aria-label="Register"
        >
          <RegisterIcon />
          <span className="dash-mobile-nav-label">Register</span>
        </button>

        {/* Centre FAB — always opens action sheet */}
        <button
          className="dash-mobile-fab"
          onClick={() => setShowFabMenu(v => !v)}
          aria-label="Quick actions"
          aria-expanded={showFabMenu}
        >
          <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: showFabMenu ? 'rotate(45deg)' : 'none', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>＋</span>
        </button>

        <button
          className={`dash-mobile-nav-btn${activeNav === 'suppliers' ? ' active' : ''}`}
          onClick={() => handleNavClick('suppliers')}
          aria-label="Parties"
        >
          <SuppliersNavIcon />
          <span className="dash-mobile-nav-label">Parties</span>
        </button>
        <button
          className={`dash-mobile-nav-btn${activeNav === 'payments' ? ' active' : ''}`}
          onClick={() => handleNavClick('payments')}
          aria-label="Payments"
        >
          <PaymentsNavIcon />
          <span className="dash-mobile-nav-label">Payments</span>
        </button>
      </nav>

      {/* ── FAB Action Sheet — slides up above the nav bar ── */}
      {showFabMenu && (
        <div
          className="fab-backdrop"
          onClick={() => setShowFabMenu(false)}
          aria-hidden="true"
        />
      )}
      <div className={`fab-action-sheet${showFabMenu ? ' fab-action-sheet--open' : ''}`} role="menu">
        <button
          className="fab-action-item"
          onClick={() => { setShowFabMenu(false); setShowEntryForm(true) }}
          role="menuitem"
        >
          <span className="fab-action-icon fab-action-icon--purchase">
            <RegisterIcon />
          </span>
          <div className="fab-action-text">
            <span className="fab-action-label">Add Purchase</span>
            <span className="fab-action-sub">Log a new invoice entry</span>
          </div>
        </button>
        <button
          className="fab-action-item"
          onClick={() => { setShowFabMenu(false); setPayFormCount(c => c + 1); handleNavClick('payments') }}
          role="menuitem"
        >
          <span className="fab-action-icon fab-action-icon--payment">
            <PaymentsNavIcon />
          </span>
          <div className="fab-action-text">
            <span className="fab-action-label">Record Payment</span>
            <span className="fab-action-sub">Mark a supplier payment</span>
          </div>
        </button>
        <button
          className="fab-action-item"
          onClick={() => { setShowFabMenu(false); setSupFormCount(c => c + 1); handleNavClick('suppliers') }}
          role="menuitem"
        >
          <span className="fab-action-icon fab-action-icon--supplier">
            <SuppliersNavIcon />
          </span>
          <div className="fab-action-text">
            <span className="fab-action-label">Add Supplier</span>
            <span className="fab-action-sub">Register a new party</span>
          </div>
        </button>
      </div>

      {/* ── Purchase Entry Form modal ── */}
      {showEntryForm && (
        <PurchaseEntryForm
          onClose={() => setShowEntryForm(false)}
          onSuccess={handleEntrySuccess}
        />
      )}
    </div>
  )
}
