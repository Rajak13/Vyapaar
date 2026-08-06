import { useState, useCallback, useRef } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Q, fetchSupplierList, fetchEntries, getAuthHeaders } from './api'
import './PurchaseRegister.css'
import PurchaseEntryForm from './PurchaseEntryForm'
import InvoiceOverlay from './InvoiceOverlay'
import { adToBs } from './adToBs.js'
import FetchBar from './FetchBar.jsx'

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
export default function PurchaseRegister({ theme, onToast }) {
  const [search,      setSearch]      = useState('')
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [suppFilter,  setSuppFilter]  = useState('')
  const [sortBy,      setSortBy]      = useState('date_desc')
  const [showFilters, setShowFilters] = useState(false)
  const [page,        setPage]        = useState(0)
  const [showForm,    setShowForm]    = useState(false)
  const [editEntry,   setEditEntry]   = useState(null)
  const [selectedEntry, setSelectedEntry] = useState(null)

  const qc = useQueryClient()
  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['entries'] })
    qc.invalidateQueries({ queryKey: Q.stats() })
    qc.invalidateQueries({ queryKey: Q.supplierBals() })
  }, [qc])

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchTimer = useRef(null)
  function handleSearch(val) {
    setSearch(val)
    setPage(0)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(val), 350)
  }

  // Build query params string
  const params = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE })
  if (suppFilter)               params.set('supplier_id', suppFilter)
  if (dateFrom)                 params.set('date_from',   dateFrom)
  if (dateTo)                   params.set('date_to',     dateTo)
  if (debouncedSearch.trim())   params.set('search',      debouncedSearch.trim())
  if (sortBy)                   params.set('sort_by',     sortBy)
  const paramsStr = params.toString()

  // Supplier list (pre-fetched by Dashboard)
  const { data: suppData } = useQuery({ queryKey: Q.suppliers(), queryFn: fetchSupplierList })
  const suppliers = suppData?.suppliers ?? []

  // Entries list — keepPreviousData keeps page N visible while page N+1 loads
  const { data: entriesData, isLoading: loading, isFetching, error: queryError } = useQuery({
    queryKey:        Q.entries(paramsStr),
    queryFn:         () => fetchEntries(paramsStr),
    placeholderData: keepPreviousData,
  })
  const entries    = entriesData?.entries ?? []
  const total      = entriesData?.total   ?? 0
  const error      = queryError?.message  ?? ''
  const isRefreshing = isFetching && !loading   // background refresh, data already present

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
      headers: getAuthHeaders(),
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
      <FetchBar active={isRefreshing} />

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
            placeholder="Search invoice or supplier…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
          {search && (
            <button className="pr-search-clear" onClick={() => { setSearch(''); setPage(0); refresh() }} aria-label="Clear search">×</button>
          )}
        </div>

        <button
          className={`pr-btn-filter-toggle${showFilters ? ' active' : ''}${hasFilters ? ' has-filters' : ''}`}
          onClick={() => setShowFilters(v => !v)}
          aria-label="Toggle supplier and date filters"
        >
          <FilterIcon />
          <span className="pr-filter-btn-label">Filters</span>
          {hasFilters && <span className="pr-filter-dot" />}
        </button>

        <div className="pr-sort-wrap">
          <select
            className="pr-filter-select pr-sort-select"
            value={sortBy}
            onChange={e => { setSortBy(e.target.value); setPage(0) }}
            aria-label="Sort entries"
          >
            <option value="date_desc">Sort: Newest First</option>
            <option value="date_asc">Sort: Oldest First</option>
            <option value="amount_desc">Sort: Amount (High → Low)</option>
            <option value="amount_asc">Sort: Amount (Low → High)</option>
            <option value="due_desc">Sort: Highest Due First</option>
            <option value="supplier_asc">Sort: Supplier (A–Z)</option>
            <option value="supplier_desc">Sort: Supplier (Z–A)</option>
          </select>
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
      <div className={`pr-table-wrap${isRefreshing ? ' pr-table-wrap--refreshing' : ''}`}>
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

      {/* ── Mobile card list (visible on <768px via CSS) ── */}
      <div className={`pr-mobile-cards${isRefreshing ? ' pr-mobile-cards--refreshing' : ''}`}>
        {loading && [...Array(4)].map((_, i) => (
          <div key={i} className="pr-mobile-card pr-mobile-card--skeleton">
            <div className="pr-skeleton" style={{ width: '60%', height: 14, marginBottom: 8 }} />
            <div className="pr-skeleton" style={{ width: '40%', height: 11 }} />
            <div className="pr-skeleton" style={{ width: '80%', height: 13, marginTop: 12 }} />
            <div className="pr-skeleton" style={{ width: '35%', height: 18, marginTop: 8 }} />
          </div>
        ))}
        {!loading && entries.map(entry => (
          <div key={entry.id} className="pr-mobile-card" onClick={() => setSelectedEntry(entry)}>
            <div className="pr-mobile-card-header">
              <div>
                <span className="pr-mobile-card-inv">{entry.invoice_no}</span>
                <div className="pr-mobile-card-date">{entry.date_bs || adToBs(entry.date_ad) || '—'}</div>
              </div>
              <PayStatusBadge status={entry.paid_status} />
            </div>

            <div className="pr-mobile-card-body">
              <div className="pr-mobile-card-supplier">{entry.supplier_name}</div>
              {entry.supplier_pan && <div className="pr-mobile-card-pan">PAN: {entry.supplier_pan}</div>}
            </div>

            <div className="pr-mobile-card-footer">
              <div>
                <span className="pr-mobile-card-label">Grand Total</span>
                <span className="pr-mobile-card-amount">{fmtRs(entry.grand_total)}</span>
              </div>

              <div className="pr-mobile-card-actions" onClick={e => e.stopPropagation()}>
                <button className="pr-action-btn" onClick={() => openEdit(entry)} title="Edit entry">
                  <EditIcon />
                </button>
                <button className="pr-action-btn pr-action-btn--delete" onClick={() => handleDelete(entry.id)} title="Delete entry">
                  <DeleteIcon />
                </button>
              </div>
            </div>
          </div>
        ))}
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