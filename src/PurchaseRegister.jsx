import { useState, useCallback, useRef } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Q, fetchSupplierList, fetchEntries, fetchBusinessProfile, getAuthHeaders } from './api'
import './PurchaseRegister.css'
import PurchaseEntryForm from './PurchaseEntryForm'
import InvoiceOverlay from './InvoiceOverlay'
import { adToBs } from './adToBs.js'
import { exportPurchaseRegisterPDF } from './exportPdf.js'
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
function DeleteIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
}
function PdfIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
}
function SheetIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
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
  const [billTypeFilter,  setBillTypeFilter]  = useState('all')
  const [page,        setPage]        = useState(0)
  const [showFilters, setShowFilters] = useState(false)
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
  if (billTypeFilter === 'regular') params.set('is_missed_bill', 'false')
  if (billTypeFilter === 'missed')  params.set('is_missed_bill', 'true')
  if (debouncedSearch.trim())   params.set('search',      debouncedSearch.trim())
  if (sortBy)                   params.set('sort_by',     sortBy)
  const paramsStr = params.toString()

  const [isExporting, setIsExporting] = useState(false)

  // Supplier list (pre-fetched by Dashboard)
  const { data: suppData } = useQuery({ queryKey: Q.suppliers(), queryFn: fetchSupplierList })
  const suppliers = suppData?.suppliers ?? []

  // Business profile for PDF export
  const { data: profileData } = useQuery({ queryKey: Q.businessProfile(), queryFn: fetchBusinessProfile })
  const profile = profileData?.profile ?? {}

  // Entries list — keepPreviousData keeps page N visible while page N+1 loads
  const { data: entriesData, isLoading: loading, isFetching, error: queryError } = useQuery({
    queryKey:        Q.entries(paramsStr),
    queryFn:         () => fetchEntries(paramsStr),
    placeholderData: keepPreviousData,
  })
  const entries    = entriesData?.entries ?? []
  const total      = entriesData?.total   ?? 0
  const totals     = entriesData?.totals  ?? null
  const error      = queryError?.message  ?? ''
  const isRefreshing = isFetching && !loading   // background refresh, data already present

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasFilters = Boolean(search || suppFilter || dateFrom || dateTo || billTypeFilter !== 'all')

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

  // Helper to get unpaginated filter query for exports
  function getExportFilterParams() {
    const p = new URLSearchParams()
    if (suppFilter)               p.set('supplier_id', suppFilter)
    if (dateFrom)                 p.set('date_from',   dateFrom)
    if (dateTo)                   p.set('date_to',     dateTo)
    if (billTypeFilter === 'regular') p.set('is_missed_bill', 'false')
    if (billTypeFilter === 'missed')  p.set('is_missed_bill', 'true')
    if (debouncedSearch.trim())   p.set('search',      debouncedSearch.trim())
    if (sortBy)                   p.set('sort_by',     sortBy)
    p.set('limit', 'all')
    return p.toString()
  }

  // Quick date presets
  function setDatePreset(preset) {
    const today = new Date()
    if (preset === 'this_month') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1)
      setDateFrom(first.toISOString().slice(0, 10))
      setDateTo(today.toISOString().slice(0, 10))
    } else if (preset === 'last_month') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const last  = new Date(today.getFullYear(), today.getMonth(), 0)
      setDateFrom(first.toISOString().slice(0, 10))
      setDateTo(last.toISOString().slice(0, 10))
    } else if (preset === 'clear') {
      setDateFrom('')
      setDateTo('')
    }
    setPage(0)
  }


  // Full unpaginated Excel export with colors, dynamic column widths, and proper number formatting
  async function exportExcel() {
    setIsExporting(true)
    try {
      const res = await fetchEntries(getExportFilterParams())
      const allEntries = res.entries ?? []
      if (allEntries.length === 0) {
        if (onToast) onToast('No entries found to export.', 'error')
        return
      }
      const { exportPurchaseRegisterExcel } = await import('./exportExcel.js')
      await exportPurchaseRegisterExcel({
        entries: allEntries,
        totals: res.totals ?? {},
        filters: { dateFrom, dateTo, suppFilter, billTypeFilter, search },
        profile: profile
      })
      if (onToast) onToast(`Exported all ${allEntries.length} entries to styled Excel (.xlsx).`, 'success')
    } catch (err) {
      console.error(err)
      if (onToast) onToast('Failed to export Excel: ' + err.message, 'error')
    } finally {
      setIsExporting(false)
    }
  }

  // Full unpaginated PDF export
  async function exportPDF() {
    setIsExporting(true)
    try {
      const res = await fetchEntries(getExportFilterParams())
      const allEntries = res.entries ?? []
      if (allEntries.length === 0) {
        if (onToast) onToast('No entries found to export.', 'error')
        return
      }
      exportPurchaseRegisterPDF({
        entries: allEntries,
        totals: res.totals ?? {},
        filters: { dateFrom, dateTo, suppFilter, billTypeFilter, search },
        profile: profile
      })
      if (onToast) onToast(`Opened PDF for ${allEntries.length} entries.`, 'success')
    } catch (err) {
      console.error(err)
      if (onToast) onToast('Failed to export PDF: ' + err.message, 'error')
    } finally {
      setIsExporting(false)
    }
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
          <button className="pr-btn-ghost pr-btn-ghost--excel" onClick={exportExcel} disabled={entries.length === 0 || isExporting} title="Export styled Excel spreadsheet with colors & auto-fit columns">
            <SheetIcon />
            <span>{isExporting ? 'Exporting…' : 'Export Excel'}</span>
          </button>
          <button className="pr-btn-ghost" onClick={exportPDF} disabled={entries.length === 0 || isExporting} title="Export VAT Purchase Register PDF (खरिद खाता)">
            <PdfIcon />
            <span>{isExporting ? 'Exporting…' : 'PDF'}</span>
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

      {/* ── Bill Type Filter Pills (Regular vs Missed Bills) ── */}
      <div className="pr-type-pills">
        <button
          className={`pr-type-pill${billTypeFilter === 'all' ? ' active' : ''}`}
          onClick={() => { setBillTypeFilter('all'); setPage(0) }}
        >
          All Entries
        </button>
        <button
          className={`pr-type-pill${billTypeFilter === 'regular' ? ' active' : ''}`}
          onClick={() => { setBillTypeFilter('regular'); setPage(0) }}
        >
          Regular Bills
        </button>
        <button
          className={`pr-type-pill pr-type-pill-missed${billTypeFilter === 'missed' ? ' active' : ''}`}
          onClick={() => { setBillTypeFilter('missed'); setPage(0) }}
        >
          Missed Bills (छूट बिल)
        </button>
      </div>

      {showFilters && (
        <div className="pr-filters">
          <div className="pr-filter-presets">
            <span className="pr-filter-preset-label">Quick Dates:</span>
            <button type="button" className="pr-date-preset-btn" onClick={() => setDatePreset('this_month')}>
              यस महिना (This Month)
            </button>
            <button type="button" className="pr-date-preset-btn" onClick={() => setDatePreset('last_month')}>
              अघिल्लो महिना (Last Month)
            </button>
            {(dateFrom || dateTo) && (
              <button type="button" className="pr-date-preset-btn pr-date-preset-btn--clear" onClick={() => setDatePreset('clear')}>
                Clear Dates
              </button>
            )}
          </div>
          <div className="pr-filter-grid">
            <div className="pr-filter-group">
              <label className="pr-filter-label">Supplier</label>
              <select className="pr-filter-select" value={suppFilter} onChange={e => { setSuppFilter(e.target.value); setPage(0); refresh() }}>
                <option value="">All suppliers</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="pr-filter-group">
              <label className="pr-filter-label">Bill Type</label>
              <select
                className="pr-filter-select"
                value={billTypeFilter}
                onChange={e => { setBillTypeFilter(e.target.value); setPage(0); refresh() }}
              >
                <option value="all">All Entries</option>
                <option value="regular">Regular Bills only</option>
                <option value="missed">Missed Bills (छूट बिल) only</option>
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
          </div>
          <div className="pr-filter-bottom-row">
            {hasFilters && (
              <button className="pr-filter-clear" onClick={() => { setSearch(''); setSuppFilter(''); setBillTypeFilter('all'); setDateFrom(''); setDateTo(''); setPage(0); refresh() }}>
                Clear all filters
              </button>
            )}
            <div className="pr-filter-export-group">
              <button type="button" className="pr-btn-export-outline pr-btn-export-outline--excel" onClick={exportExcel} disabled={isExporting || total === 0} title="Export styled Excel (.xls)">
                <SheetIcon /> {isExporting ? 'Exporting…' : 'Export Excel'}
              </button>
              <button type="button" className="pr-btn-export-outline" onClick={exportPDF} disabled={isExporting || total === 0} title="Export VAT Register PDF">
                <PdfIcon /> {isExporting ? 'Exporting…' : 'PDF (खरिद खाता)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="pr-error-banner">{error}</div>}

      {/* ── Live Billing Insights Summary Strip ── */}
      {totals && Number(totals.count) > 0 && (
        <div className="pr-totals-card">
          <div className="pr-totals-head">
            <div className="pr-totals-title-wrap">
              <span className="pr-totals-badge">{hasFilters ? 'Filtered Totals' : 'Register Summary'}</span>
              <span className="pr-totals-count">{totals.count} {totals.count === 1 ? 'bill' : 'bills'}</span>
              {(dateFrom || dateTo) && (
                <span className="pr-totals-period">
                  ({dateFrom || 'Start'} → {dateTo || 'Today'})
                </span>
              )}
            </div>
            <div className="pr-totals-quick-actions">
              <button
                type="button"
                className="pr-btn-mini-export pr-btn-mini-export--excel"
                onClick={exportExcel}
                disabled={isExporting}
                title="Download styled Excel spreadsheet (.xls) with colors & auto-fit columns"
              >
                <SheetIcon />
                <span>{isExporting ? 'Exporting…' : 'Excel'}</span>
              </button>
              <button
                type="button"
                className="pr-btn-mini-export"
                onClick={exportPDF}
                disabled={isExporting}
                title="Download / Print VAT Purchase Register PDF"
              >
                <PdfIcon />
                <span>{isExporting ? 'Exporting…' : 'PDF'}</span>
              </button>
            </div>
          </div>

          <div className="pr-totals-grid">
            <div className="pr-stat-box pr-stat-box--grand">
              <span className="pr-stat-label">Grand Total (जम्मा)</span>
              <span className="pr-stat-val pr-stat-val--grand">{fmtRs(totals.grand_total)}</span>
            </div>
            <div className="pr-stat-box">
              <span className="pr-stat-label">Taxable (करयोग्य)</span>
              <span className="pr-stat-val">{fmtRs(totals.taxable_purchases)}</span>
            </div>
            <div className="pr-stat-box">
              <span className="pr-stat-label">Tax-Free (कर छुट)</span>
              <span className="pr-stat-val">{fmtRs(totals.tax_exempt_purchases)}</span>
            </div>
            <div className="pr-stat-box pr-stat-box--vat">
              <span className="pr-stat-label">13% VAT (भ्याट)</span>
              <span className="pr-stat-val pr-stat-val--vat">{fmtRs(totals.tax_amount)}</span>
            </div>
            {Number(totals.amount_due) > 0 && (
              <div className="pr-stat-box pr-stat-box--due">
                <span className="pr-stat-label">Due / Pending (बाँकी)</span>
                <span className="pr-stat-val pr-stat-val--due">{fmtRs(totals.amount_due)}</span>
              </div>
            )}
          </div>
        </div>
      )}

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
                <td className="pr-td-bold">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>{entry.invoice_no}</span>
                    {entry.is_missed_bill && (
                      <span className="pr-missed-tag" title="Missed / Late Purchase Bill (छूट खरिद बिल)">छूट बिल</span>
                    )}
                  </div>
                </td>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="pr-mobile-card-inv">{entry.invoice_no}</span>
                  {entry.is_missed_bill && <span className="pr-missed-tag">छूट बिल</span>}
                </div>
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
          theme={theme}
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