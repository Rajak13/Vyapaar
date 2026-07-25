import { useEffect, useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Q,
  fetchStats, fetchRecentEntries, fetchSupplierBals,
  fetchSupplierList, fetchPaymentStats, fetchPayments, fetchEntries,
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

  // ── Fetch overview data via React Query ───────────────────────────────────
  const { data: statsData,    isLoading: loadingStats    } = useQuery({ queryKey: Q.stats(),         queryFn: fetchStats })
  const { data: entriesData,  isLoading: loadingEntries  } = useQuery({ queryKey: Q.recentEntries(), queryFn: fetchRecentEntries })
  const { data: balancesData, isLoading: loadingBalances } = useQuery({ queryKey: Q.supplierBals(),  queryFn: fetchSupplierBals })

  const loadingData = loadingStats || loadingEntries || loadingBalances

  // ── Prefetch all other pages as soon as the dashboard mounts ─────────────
  // This means navigating to Suppliers / Register / Payments for the first time
  // is INSTANT — data is already in cache.
  useEffect(() => {
    qc.prefetchQuery({ queryKey: Q.suppliers(),    queryFn: fetchSupplierList })
    qc.prefetchQuery({ queryKey: Q.paymentStats(), queryFn: fetchPaymentStats })
    qc.prefetchQuery({ queryKey: Q.payments('limit=50'), queryFn: () => fetchPayments('limit=50') })
    qc.prefetchQuery({ queryKey: Q.entries('limit=20&offset=0'), queryFn: () => fetchEntries('limit=20&offset=0') })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

          {/* Left icon sidebar */}
          <aside className="dash-sidebar">
            <div className="dash-sidebar-inner">
              {NAV_ITEMS.map(({ key, Icon, title }) => (
                <button
                  key={key}
                  className={`dash-sidebar-btn${activeNav === key ? ' active' : ''}`}
                  onClick={() => handleNavClick(key)}
                  title={title}
                  aria-label={title}
                >
                  <Icon />
                </button>
              ))}
              <div className="dash-sidebar-divider" />
              <button
                className="dash-sidebar-btn"
                onClick={handleLogout}
                title="Log out"
                aria-label="Log out"
              >
                <LogoutIcon />
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
              <Suppliers onToast={onToast} />
            )}

            {activeNav === 'payments' && (
              <Payments onToast={onToast} />
            )}

            {activeNav === 'settings' && (
              <Settings onToast={onToast} user={user} />
            )}

            {activeNav === 'overview' && (<>
              <div className="dash-welcome-row">
                <div className="dash-date-card">
                  <span className="dash-date-num">{dayNum}</span>
                  <span className="dash-date-sub">{dayName}, {monName}</span>
                </div>
                <div className="dash-greeting-block">
                  <div className="dash-greeting-line">{greeting},</div>
                  <div className="dash-greeting-name">{fullName}</div>
                </div>
                <button className="dash-view-entries-btn" onClick={() => setShowEntryForm(true)}>
                  <span>View Recent Entries</span>
                  <ArrowIcon />
                </button>
              </div>

              {/* Stat cards — bento proportions */}
              <div className="dash-stats-row">

                <div className="dash-card dash-stat-accent">
                  <div className="dash-stat-label"><ShoppingIcon /><span>Total Purchases</span></div>
                  <div className="dash-stat-value">{fmtRs(stats.totalPurchasesFY)}</div>
                  <div className="dash-stat-sub">Current fiscal year</div>
                  <div className="dash-stat-watermark" aria-hidden="true">
                    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
                  </div>
                </div>

                <div className="dash-card dash-stat-ring">
                  <div className="dash-stat-label"><SuppliersIcon /><span>Active Suppliers</span></div>
                  <div className="dash-ring-wrap">
                    <div className="dash-ring" aria-label={`${stats.activeSuppliers} active suppliers`}>
                      <svg viewBox="0 0 72 72">
                        <circle className="dash-ring-track" cx="36" cy="36" r="30" />
                        <circle
                          className="dash-ring-fill"
                          cx="36" cy="36" r="30"
                          strokeDashoffset={
                            // Fill proportional to capped display value; 0 suppliers = empty ring
                            stats.activeSuppliers > 0
                              ? Math.max(10, 188.5 * (1 - Math.min(stats.activeSuppliers, 20) / 20))
                              : 188.5
                          }
                        />
                      </svg>
                      <div className="dash-ring-label">{stats.activeSuppliers}</div>
                    </div>
                  </div>
                  <div className="dash-stat-sub">Verified partners</div>
                </div>

                <div className="dash-card">
                  <div className="dash-stat-label"><CashIcon /><span>Pending Payments</span></div>
                  {/* TODO: wire to supplier_balances view when payment tracking is built */}
                  <div className="dash-stat-value">{fmtRs(stats.pendingPayments)}</div>
                  <div className="dash-stat-sub">Payable to suppliers</div>
                </div>

                <div className="dash-card">
                  <div className="dash-stat-label"><RegisterIcon /><span>Entries This Month</span></div>
                  <div className="dash-stat-value">{stats.entriesThisMonth}</div>
                  <div className="dash-stat-sub">Current BS period</div>
                </div>

              </div>

              {/* Entries table */}
              <div className="dash-card dash-table-card">
                <div className="dash-table-header">
                  <h4 className="dash-table-title">Recent Purchase Entries</h4>
                  <button className="dash-view-all-btn" onClick={() => handleNavClick('register')}>
                    <span>View all entries</span>
                    <ChevronIcon />
                  </button>
                </div>
                <div className="dash-table-wrap">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Invoice No.</th>
                        <th>Date (BS)</th>
                        <th>Supplier</th>
                        <th className="text-right">Taxable (Rs.)</th>
                        <th className="text-right">Grand Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.length === 0 && !loadingData && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: 'var(--dm)', padding: '24px' }}>
                            No entries yet — add your first purchase entry.
                          </td>
                        </tr>
                      )}
                      {entries
                        .filter(e => {
                          if (!searchQuery.trim()) return true
                          const q = searchQuery.toLowerCase()
                          return (
                            e.invoice_no?.toLowerCase().includes(q) ||
                            e.supplier_name?.toLowerCase().includes(q)
                          )
                        })
                        .map(entry => (
                          <tr key={entry.id}>
                            <td className="dash-td-muted">{entry.invoice_no}</td>
                            <td className="dash-td-muted">{entry.date_bs || adToBs(entry.date_ad) || '—'}</td>
                            <td className="dash-td-muted">{entry.supplier_name}</td>
                            <td className="dash-td-muted text-right">
                              {entry.taxable_purchases > 0 ? fmtRs(entry.taxable_purchases) : '—'}
                            </td>
                            <td className="dash-td-bold text-right">{fmtRs(entry.grand_total)}</td>
                            <td>
                              <span className={`dash-badge dash-badge-${
                                entry.paid_status === 'paid'    ? 'paid' :
                                entry.paid_status === 'partial' ? 'partial' : 'pending'
                              }`}>
                                {entry.paid_status === 'paid' ? 'Paid' : entry.paid_status === 'partial' ? 'Partial' : 'Pending'}
                              </span>
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
                <div className="dash-table-footer">
                  {searchQuery.trim()
                    ? `Showing filtered results — press Enter to search all ${entriesTotal} entries`
                    : `Showing latest ${entries.length} of ${entriesTotal} entries`
                  }
                </div>
              </div>

              {/* Financial insights row */}
              <div className="dash-insights-row">
                <div className="dash-card">
                  <div className="dash-insight-label">Tax Breakdown</div>
                  <div className="dash-insight-row">
                    <span className="dash-insight-name">VAT (13%)</span>
                    <span className="dash-insight-val">{fmtRs(stats.taxTotal)}</span>
                  </div>
                  <div className="dash-progress-track">
                    <div className="dash-progress-bar" style={{
                      width: stats.totalPurchasesFY > 0
                        ? `${Math.min(100, Math.round((parseFloat(stats.taxTotal) / parseFloat(stats.totalPurchasesFY)) * 100))}%`
                        : '0%'
                    }} />
                  </div>
                  <p className="dash-insight-note">Accumulated tax liabilities for the current fiscal year.</p>
                </div>

                <div className="dash-card">
                  <div className="dash-insight-label">Growth Index</div>
                  <div className="dash-growth-value-inline">{fmtRs(stats.totalPurchasesFY)}</div>
                  <svg className="dash-growth-chart" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ab2f00" stopOpacity="0.15"/>
                        <stop offset="100%" stopColor="#ab2f00" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    <path d="M0 50 C20 50 30 45 45 38 C60 31 70 42 85 35 C100 28 110 20 125 18 C140 16 150 22 165 15 C175 10 185 8 200 5" fill="none" stroke="#ab2f00" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M0 50 C20 50 30 45 45 38 C60 31 70 42 85 35 C100 28 110 20 125 18 C140 16 150 22 165 15 C175 10 185 8 200 5 L200 60 L0 60 Z" fill="url(#growthGrad)"/>
                  </svg>
                </div>
              </div>

            </>)}
          </main>

          {/* Right sidebar */}
          <aside className="dash-right-sidebar">

            {/* Fiscal Period card — real data from stats endpoint */}
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

            {/* Spend by Supplier — real data from supplier_balances */}
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

            <div className="dash-card dash-action-card">
              <div className="dash-action-icon"><PlusIcon /></div>
              <h5 className="dash-action-title">New Purchase</h5>
              <p className="dash-action-body">Log a new purchase invoice in seconds.</p>
              <button className="dash-action-btn" onClick={() => setShowEntryForm(true)}>
                Add Entry Now
              </button>
            </div>

          </aside>
        </div>

      </div>

      {/* ── Mobile bottom tab bar — replaces sidebar on small screens ── */}
      <nav className="dash-mobile-nav" aria-label="Main navigation">
        {NAV_ITEMS.map(({ key, Icon, title }) => (
          <button
            key={key}
            className={`dash-mobile-nav-btn${activeNav === key ? ' active' : ''}`}
            onClick={() => handleNavClick(key)}
            aria-label={title}
          >
            <Icon />
            <span className="dash-mobile-nav-label">{title.split(' ')[0]}</span>
          </button>
        ))}
      </nav>

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
