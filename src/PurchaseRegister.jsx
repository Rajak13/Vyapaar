import { useState, useEffect, useCallback, useRef } from 'react'
import './PurchaseRegister.css'
import PurchaseEntryForm from './PurchaseEntryForm'
import InvoiceOverlay from './InvoiceOverlay'
import { adToBs } from './adToBs.js'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

const PAGE_SIZE = 20

function fmtRs(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d) {
  if (!d) return '—'
  return d.slice(0, 10)
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
}
function SearchIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
}
function ChevronLeftIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
}
function ChevronRightIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
}
function EditIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}
function FilterIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
}
function DownloadIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
}
function DeleteIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
}

// ── Paid status badge ─────────────────────────────────────────────────────────
function PayStatusBadge({ status }) {
  const map = {
    paid:    { label: 'Paid',    cls: 'pr-status-paid'    },
    partial: { label: 'Partial', cls: 'pr-status-partial' },
    pending: { label: 'Pending', cls: 'pr-status-pending' },
  }
  const { label, cls } = map[status] ?? map.pending
  return <span className={`pr-status-badge ${cls}`}>{label}</span>
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="pr-skeleton-row">
      {[...Array(10)].map((_, i) => (
        <td key={i}><span className="pr-skeleton" /></td>
      ))}
    </tr>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ hasFilters, onAdd }) {
  return (
    <tr>
      <td colSpan={9} className="pr-empty">
        <div className="pr-empty-inner">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--dm)', marginBottom: 12 }}>
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <p className="pr-empty-title">{hasFilters ? 'No entries match your filters' : 'No purchase entries yet'}</p>
          <p className="pr-empty-body">{hasFilters ? 'Try clearing your search or date filters.' : 'Add your first purchase entry to get started.'}</p>
          {!hasFilters && (
            <button className="pr-empty-btn" onClick={onAdd}>
              <PlusIcon /> Add Entry
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PurchaseRegister({ theme, onToast, refreshKey: externalRefreshKey }) {
  // ── Filter / search state ─────────────────────────────────────────────
  const [search,      setSearch]      = useState('')
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [suppFilter,  setSuppFilter]  = useState('')  // supplier_id
  const [suppliers,   setSuppliers]   = useState([])
  const [showFilters, setShowFilters] = useState(false)

  // ── Data state ────────────────────────────────────────────────────────────
  const [entries,     setEntries]     = useState([])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')

  // ── Form state ────────────────────────────────────────────────────────────
  const [showForm,    setShowForm]    = useState(false)
  const [editEntry,   setEditEntry]   = useState(null)

  // ── Invoice overlay ────────────────────────────────────────────────────────
  const [selectedEntry, setSelectedEntry] = useState(null)

  // ── Internal refresh ──────────────────────────────────────────────────────
  const [refreshKey, setRefreshKey]  = useState(0)
  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  // Debounced search
  const searchTimer = useRef(null)
  function handleSearch(val) {
    setSearch(val)
    setPage(0)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(refresh, 350)
  }

  // Load supplier list for filter dropdown
  useEffect(() => {
    fetch(`${API_URL}/api/suppliers`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { suppliers: [] })
      .then(j => setSuppliers(j.suppliers ?? []))
      .catch(() => {})
  }, [])

  // Fetch entries when page / filters / refresh key changes
  useEffect(() => {
    setLoading(true)
    setError('')

    const params = new URLSearchParams({
      limit:  PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
    if (suppFilter) params.set('supplier_id', suppFilter)
    if (dateFrom)   params.set('date_from',   dateFrom)
    if (dateTo)     params.set('date_to',      dateTo)
    if (search.trim()) params.set('search',    search.trim())

    fetch(`${API_URL}/api/purchase-entries?${params}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => { setEntries(j.entries ?? []); setTotal(j.total ?? 0) })
      .catch(() => setError('Failed to load entries.'))
      .finally(() => setLoading(false))
  }, [page, suppFilter, dateFrom, dateTo, refreshKey, externalRefreshKey])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasFilters = Boolean(search || suppFilter || dateFrom || dateTo)

  function handleEntrySuccess(msg) {
    setShowForm(false)
    setEditEntry(null)
    refresh()
    if (onToast) onToast(msg, 'success')
  }

  function openEdit(entry) {
    setEditEntry(entry)
    setShowForm(true)
  }

  function handleDelete(id) {
    if (!window.confirm('Delete this entry? This action cannot be undone.')) return
    fetch(`${API_URL}/api/purchase-entries/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
      .then(async res => {
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error ?? 'Failed to delete entry')
        }
      })
      .then(() => {
        refresh()
        if (onToast) onToast('Entry deleted successfully.', 'success')
      })
      .catch(err => {
        console.error(err)
        if (onToast) onToast(err.message || 'Failed to delete entry', 'error')
      })
  }

  // CSV export
  function exportCSV() {
    if (entries.length === 0) return
    const headers = ['Invoice No.', 'Date (BS)', 'Date (AD)', 'Supplier', 'PAN', 'Account Head',
      'Tax Exempt', 'Taxable Purchases', 'Taxable Imports', 'Capital Taxable', 'Tax Amount', 'Total Value', 'Grand Total', 'Notes']
    const rows = entries.map(e => [
      e.invoice_no, e.date_bs, fmtDate(e.date_ad), e.supplier_name, e.supplier_pan ?? '',
      e.account_head ?? '', e.tax_exempt_purchases, e.taxable_purchases, e.taxable_imports,
      e.capital_taxable_purchases, e.tax_amount, e.total_value, e.grand_total, e.notes ?? ''
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `purchase-register-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="pr-page">

      {/* ── Page header ── */}
      <div className="pr-header">
        <div>
          <h2 className="pr-title">Purchase Register</h2>
          <p className="pr-subtitle">{total} {total === 1 ? 'entry' : 'entries'} total</p>
        </div>
        <div className="pr-header-actions">
          <button className="pr-btn-ghost" onClick={() => setShowFilters(v => !v)}>
            <FilterIcon />
            <span>Filters{hasFilters ? ' •' : ''}</span>
          </button>
          <button className="pr-btn-ghost" onClick={exportCSV} disabled={entries.length === 0}>
            <DownloadIcon />
            <span>Export CSV</span>
          </button>
          <button className="pr-btn-primary" onClick={() => { setEditEntry(null); setShowForm(true) }}>
            <PlusIcon />
            <span>Add Entry</span>
          </button>
        </div>
      </div>

      {/* ── Search + filters bar ── */}
      <div className="pr-search-bar">
        <div className="pr-search-wrap">
          <SearchIcon />
          <input
            className="pr-search-input"
            type="text"
            placeholder="Search by invoice no. or supplier name…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
          {search && (
            <button className="pr-search-clear" onClick={() => { setSearch(''); setPage(0); refresh() }} aria-label="Clear search">×</button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="pr-filters">
          <div className="pr-filter-group">
            <label className="pr-filter-label">Supplier</label>
            <select className="pr-filter-select" value={suppFilter} onChange={e => { setSuppFilter(e.target.value); setPage(0); refresh() }}>
              <option value="">All suppliers</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="pr-filter-group">
            <label className="pr-filter-label">Date from</label>
            <input className="pr-filter-input" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); refresh() }} />
          </div>
          <div className="pr-filter-group">
            <label className="pr-filter-label">Date to</label>
            <input className="pr-filter-input" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); refresh() }} />
          </div>
          {hasFilters && (
            <button className="pr-filter-clear" onClick={() => { setSearch(''); setSuppFilter(''); setDateFrom(''); setDateTo(''); setPage(0); refresh() }}>
              Clear all filters
            </button>
          )}
        </div>
      )}

      {error && <div className="pr-error-banner">{error}</div>}

      {/* ── Table ── */}
      <div className="pr-table-wrap">
        <table className="pr-table">
          <thead>
            <tr>
              <th>Invoice No.</th>
              <th>Date (BS)</th>
              <th>Date (AD)</th>
              <th>Supplier</th>
              <th className="pr-col-num">Tax Exempt</th>
              <th className="pr-col-num">Taxable</th>
              <th className="pr-col-num">Tax Amt.</th>
              <th className="pr-col-num">Grand Total</th>
              <th>Status</th>
              <th className="pr-col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {loading && [...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
            {!loading && entries.length === 0 && <EmptyState hasFilters={hasFilters} onAdd={() => { setEditEntry(null); setShowForm(true) }} />}
            {!loading && entries.map(entry => (
              <tr key={entry.id} className="pr-row pr-row-clickable" onClick={() => setSelectedEntry(entry)}>
                <td className="pr-td-bold">{entry.invoice_no}</td>
                <td className="pr-td-muted">{entry.date_bs || adToBs(entry.date_ad) || '—'}</td>
                <td className="pr-td-muted">{fmtDate(entry.date_ad)}</td>
                <td>
                  <div className="pr-supplier-cell">
                    <span className="pr-supplier-name">{entry.supplier_name}</span>
                    {entry.supplier_pan && <span className="pr-supplier-pan">PAN: {entry.supplier_pan}</span>}
                  </div>
                </td>
                <td className="pr-col-num pr-td-muted">{entry.tax_exempt_purchases > 0 ? fmtRs(entry.tax_exempt_purchases) : '—'}</td>
                <td className="pr-col-num pr-td-muted">{entry.taxable_purchases > 0 ? fmtRs(entry.taxable_purchases) : '—'}</td>
                <td className="pr-col-num pr-td-muted">{entry.tax_amount > 0 ? fmtRs(entry.tax_amount) : '—'}</td>
                <td className="pr-col-num pr-td-grand">{fmtRs(entry.grand_total)}</td>
                <td><PayStatusBadge status={entry.paid_status} /></td>
                <td className="pr-col-actions" onClick={e => e.stopPropagation()}>
                  <button className="pr-action-btn" onClick={() => openEdit(entry)} title="Edit entry">
                    <EditIcon />
                  </button>
                  <button className="pr-action-btn pr-action-btn--delete" onClick={() => handleDelete(entry.id)} title="Delete entry">
                    <DeleteIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="pr-pagination">
          <span className="pr-pagination-info">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <div className="pr-pagination-btns">
            <button className="pr-page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
              <ChevronLeftIcon /> Prev
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                className={`pr-page-btn pr-page-num${i === page ? ' active' : ''}`}
                onClick={() => setPage(i)}
              >
                {i + 1}
              </button>
            ))}
            <button className="pr-page-btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
              Next <ChevronRightIcon />
            </button>
          </div>
        </div>
      )}

      {/* ── Form modal ── */}
      {showForm && (
        <PurchaseEntryForm
          initialData={editEntry}
          onClose={() => { setShowForm(false); setEditEntry(null) }}
          onSuccess={handleEntrySuccess}
        />
      )}

      {/* ── Invoice overlay ── */}
      {selectedEntry && (
        <InvoiceOverlay
          type="purchase"
          data={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  )
}