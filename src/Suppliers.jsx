import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Q, fetchSupplierBals, apiFetch, getAuthHeaders } from './api'
import './Suppliers.css'
import FetchBar from './FetchBar.jsx'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')


function fmtRs(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return 'Rs. 0'
  return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function DownloadIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
}

function exportSuppliersCSV(suppliers) {
  if (!suppliers || suppliers.length === 0) return
  const headers = ['Supplier Name', 'PAN', 'Phone', 'Address', 'Total Purchased (Rs)', 'Total Paid (Rs)', 'Balance Due (Rs)', 'Status']
  const rows = suppliers.map(s => [
    `"${s.supplier_name || ''}"`,
    `"${s.supplier_pan || ''}"`,
    `"${s.phone || ''}"`,
    `"${s.address || ''}"`,
    s.total_purchased || 0,
    s.total_paid || 0,
    s.balance_due || 0,
    `"${s.is_active ? 'Active' : 'Inactive'}"`
  ])
  
  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', `Vyapaar_Suppliers_Ledger_${new Date().toISOString().slice(0,10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
function PlusIcon()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> }
function EditIcon()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function SearchIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> }
function CloseIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg> }
function ArrowIcon()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg> }
function DeleteIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
}
function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 0 0 1.333 4.993L2 22l5.233-1.237a9.96 9.96 0 0 0 4.779 1.217h.004c5.505 0 9.988-4.478 9.989-9.985 0-2.669-1.038-5.176-2.925-7.062A9.92 9.92 0 0 0 12.012 2zm5.783 14.156c-.244.686-1.42 1.309-1.956 1.365-.494.052-1.139.083-3.267-.798-2.72-1.127-4.477-3.896-4.613-4.077-.135-.181-1.107-1.472-1.107-2.808 0-1.336.7-1.992.948-2.261.248-.268.541-.335.722-.335.18 0 .36.002.518.009.169.007.396-.064.62.473.23.551.789 1.926.857 2.064.068.138.113.3.023.477-.09.178-.135.291-.27.452-.136.16-.285.358-.407.481-.136.136-.277.284-.119.555.158.27.702 1.157 1.507 1.874 1.036.923 1.91 1.209 2.181 1.344.27.135.428.113.586-.068.158-.18.677-.788.857-1.058.18-.27.36-.225.608-.135.248.09 1.577.743 1.847.878.27.135.45.203.518.315.068.113.068.653-.176 1.339z" />
    </svg>
  )
}

function shareWhatsApp(s) {
  const phone = (s.phone ?? '').replace(/\D/g, '')
  const due = parseFloat(s.balance_due ?? 0)
  const purchased = parseFloat(s.total_purchased ?? 0)
  const paid = parseFloat(s.total_paid ?? 0)
  
  const text = `Namaste ${s.supplier_name},\n\nHere is your ledger statement with Vyapaaar:\n• Total Purchased: ${fmtRs(purchased)}\n• Total Paid: ${fmtRs(paid)}\n• Current Balance Due: ${fmtRs(due)}\n\nThank you!`
  const encodedText = encodeURIComponent(text)
  const waUrl = phone
    ? `https://wa.me/${phone.startsWith('977') ? phone : '977' + phone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`

  window.open(waUrl, '_blank')
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="sup-skeleton-row">
      {[...Array(7)].map((_, i) => <td key={i}><span className="sup-skeleton" style={{ width: `${50 + i * 8}%` }} /></td>)}
    </tr>
  )
}

// ── Supplier form (slide-in panel) ────────────────────────────────────────────
function SupplierForm({ supplier, onClose, onSuccess }) {
  const isEdit = Boolean(supplier?.id)
  const [name,           setName]           = useState(supplier?.supplier_name ?? supplier?.name ?? '')
  const [pan,            setPan]            = useState(supplier?.supplier_pan  ?? supplier?.pan  ?? '')
  const [phone,          setPhone]          = useState(supplier?.phone   ?? '')
  const [address,        setAddress]        = useState(supplier?.address ?? '')
  const [openingBalance, setOpeningBalance] = useState(supplier?.opening_balance ?? '')
  const [isActive,       setIsActive]       = useState(supplier?.is_active !== false)
  const [loading,        setLoading]        = useState(false)
  const [errs,           setErrs]           = useState({})

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [onClose])

  function validate() {
    const e = {}
    if (!name.trim()) e.name = 'Supplier name is required.'
    if (pan.trim() && !/^\d{9}$/.test(pan.trim())) e.pan = 'PAN must be exactly 9 digits.'
    return e
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    const errors = validate()
    if (Object.keys(errors).length) { setErrs(errors); return }
    setErrs({}); setLoading(true)

    const body = {
      name:            name.trim(),
      pan:             pan.trim()     || undefined,
      phone:           phone.trim()   || undefined,
      address:         address.trim() || undefined,
      opening_balance: parseFloat(openingBalance) || 0,
      is_active:       isActive,
    }

    const url    = isEdit ? `${API_URL}/api/suppliers/${supplier.supplier_id ?? supplier.id}` : `${API_URL}/api/suppliers`
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const res  = await fetch(url, { method, headers: getAuthHeaders(), credentials: 'include', body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setErrs({ _global: json.error ?? 'Something went wrong.' }); setLoading(false); return }
      onSuccess(isEdit ? 'Supplier updated.' : 'Supplier added.')
      onClose()
    } catch {
      setErrs({ _global: 'Could not reach the server.' })
      setLoading(false)
    }
  }

  return (
    <div className="sup-overlay" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit Supplier' : 'Add Supplier'}>
      <div className="sup-panel">
        <div className="sup-panel-header">
          <h2 className="sup-panel-title">{isEdit ? 'EDIT SUPPLIER' : 'ADD SUPPLIER'}</h2>
          <button className="sup-panel-close" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        <div className="sup-panel-divider" />

        <form className="sup-form" onSubmit={handleSubmit} noValidate>

          <div className={`sup-field${errs.name ? ' sup-field-error' : ''}`}>
            <label className="sup-label" htmlFor="sup_name">
              NAME <span className="sup-required" aria-hidden="true">*</span>
            </label>
            <input className={`sup-input${errs.name ? ' sup-input-error' : ''}`} id="sup_name" type="text" placeholder="Supplier name" value={name} onChange={e => setName(e.target.value)} />
            {errs.name && <span className="sup-field-msg" role="alert">{errs.name}</span>}
          </div>

          <div className={`sup-field${errs.pan ? ' sup-field-error' : ''}`}>
            <label className="sup-label" htmlFor="sup_pan">PAN (9 digits)</label>
            <input className={`sup-input${errs.pan ? ' sup-input-error' : ''}`} id="sup_pan" type="text" placeholder="e.g. 123456789" maxLength={9} value={pan} onChange={e => setPan(e.target.value.replace(/\D/g, ''))} />
            {errs.pan && <span className="sup-field-msg" role="alert">{errs.pan}</span>}
          </div>

          <div className="sup-field">
            <label className="sup-label" htmlFor="sup_phone">PHONE</label>
            <input className="sup-input" id="sup_phone" type="text" placeholder="e.g. 9800000000" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>

          <div className="sup-field">
            <label className="sup-label" htmlFor="sup_address">ADDRESS</label>
            <input className="sup-input" id="sup_address" type="text" placeholder="City / address" value={address} onChange={e => setAddress(e.target.value)} />
          </div>

          <div className="sup-field">
            <label className="sup-label" htmlFor="sup_ob">OPENING BALANCE (Rs.)</label>
            <input className="sup-input" id="sup_ob" type="number" min="0" step="0.01" placeholder="Initial balance from paper notebook" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} />
          </div>

          {isEdit && (
            <label className="sup-active-toggle">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              <span>Active supplier</span>
            </label>
          )}

          {errs._global && <p className="sup-global-error" role="alert">{errs._global}</p>}

          <button className="sup-submit" type="submit" disabled={loading}>
            <span>{isEdit ? 'SAVE CHANGES' : 'ADD SUPPLIER'}</span>
            {loading
              ? <span className="sup-spinner" aria-hidden="true" />
              : <ArrowIcon />
            }
          </button>

        </form>
      </div>
    </div>
  )
}

// ── Main Suppliers page ───────────────────────────────────────────────────────
export default function Suppliers({ onToast, openForm: openFormProp }) {
  const [search,        setSearch]        = useState('')
  const [statusFilter,  setStatusFilter]  = useState('')
  const [sortBy,        setSortBy]        = useState('due_desc')
  const [showForm,      setShowForm]      = useState(false)
  const [editTarget,    setEditTarget]    = useState(null)

  // Allow Dashboard's mobile FAB action sheet to open the Add Supplier form externally.
  // Track last-seen value so re-mounting with the same counter doesn't re-open the form.
  const prevOpenFormRef = useRef(openFormProp ?? 0)
  useEffect(() => {
    if ((openFormProp ?? 0) > prevOpenFormRef.current) {
      prevOpenFormRef.current = openFormProp
      setEditTarget(null)
      setShowForm(true)
    } else {
      prevOpenFormRef.current = openFormProp ?? 0
    }
  }, [openFormProp])

  const qc = useQueryClient()
  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: Q.supplierBals() })
    qc.invalidateQueries({ queryKey: Q.suppliers() })
    qc.invalidateQueries({ queryKey: Q.stats() })
  }, [qc])

  const { data, isLoading: loading, isFetching, error: queryError } = useQuery({
    queryKey:        Q.supplierBals(),
    queryFn:         fetchSupplierBals,
    placeholderData: keepPreviousData,
  })

  const suppliers    = data?.suppliers ?? []
  const error        = queryError?.message ?? ''
  const isRefreshing = isFetching && !loading

  const filtered = suppliers
    .filter(s => {
      const due = parseFloat(s.balance_due ?? 0)
      if (statusFilter === 'due' && due <= 0) return false
      if (statusFilter === 'settled' && due > 0) return false
      if (!search.trim()) return true
      return (
        s.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
        (s.supplier_pan ?? '').includes(search)
      )
    })
    .sort((a, b) => {
      if (sortBy === 'name_asc')       return (a.supplier_name || '').localeCompare(b.supplier_name || '')
      if (sortBy === 'name_desc')      return (b.supplier_name || '').localeCompare(a.supplier_name || '')
      if (sortBy === 'due_desc')       return parseFloat(b.balance_due ?? 0) - parseFloat(a.balance_due ?? 0)
      if (sortBy === 'due_asc')        return parseFloat(a.balance_due ?? 0) - parseFloat(b.balance_due ?? 0)
      if (sortBy === 'purchased_desc') return parseFloat(b.total_purchased ?? 0) - parseFloat(a.total_purchased ?? 0)
      if (sortBy === 'paid_desc')      return parseFloat(b.total_paid ?? 0) - parseFloat(a.total_paid ?? 0)
      return 0
    })

  const totalPurchased = suppliers.reduce((a, s) => a + parseFloat(s.total_purchased ?? 0), 0)
  const totalDue       = suppliers.reduce((a, s) => a + parseFloat(s.balance_due ?? 0), 0)

  function handleSuccess(msg) {
    setShowForm(false); setEditTarget(null)
    refresh()
    if (onToast) onToast(msg, 'success')
  }

  function openEdit(s) { setEditTarget(s); setShowForm(true) }

  function handleDelete(id) {
    if (!window.confirm('Deactivate this supplier? This will hide them from active lists but keep history.')) return
    fetch(`${API_URL}/api/suppliers/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: getAuthHeaders(),
    })
      .then(async res => {
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error ?? 'Failed to deactivate supplier')
        }
      })
      .then(() => {
        refresh()
        if (onToast) onToast('Supplier deactivated successfully.', 'success')
      })
      .catch(err => {
        console.error(err)
        if (onToast) onToast(err.message || 'Failed to deactivate supplier', 'error')
      })
  }

  return (
    <div className={`sup-page${isRefreshing ? ' is-refreshing' : ''}`}>
      <FetchBar active={isRefreshing} />

      {/* Header */}
      <div className="sup-header">
        <div>
          <h2 className="sup-title">Suppliers</h2>
          <p className="sup-subtitle">{suppliers.length} {suppliers.length === 1 ? 'supplier' : 'suppliers'} registered</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="sup-btn-ghost" onClick={() => exportSuppliersCSV(suppliers)} disabled={suppliers.length === 0}>
            <DownloadIcon /><span>Export Excel</span>
          </button>
          <button className="sup-btn-primary" onClick={() => { setEditTarget(null); setShowForm(true) }}>
            <PlusIcon /><span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="sup-summary-row">
        <div className="sup-summary-card">
          <span className="sup-summary-label">Total Purchased</span>
          <span className="sup-summary-value">{fmtRs(totalPurchased)}</span>
        </div>
        <div className="sup-summary-card">
          <span className="sup-summary-label">Outstanding Balance</span>
          <span className="sup-summary-value">{fmtRs(totalDue)}</span>
        </div>
        <div className="sup-summary-card">
          <span className="sup-summary-label">Active Suppliers</span>
          <span className="sup-summary-value">{suppliers.filter(s => s.is_active).length}</span>
        </div>
      </div>

      {/* Search & Sort toolbar */}
      <div className="sup-toolbar">
        <div className="sup-search-wrap">
          <SearchIcon />
          <input
            className="sup-search-input"
            type="text"
            placeholder="Search by name or PAN…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="sup-search-clear" onClick={() => setSearch('')}>×</button>}
        </div>

        <select className="sup-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter suppliers by balance status">
          <option value="">All parties</option>
          <option value="due">Parties with balance due</option>
          <option value="settled">Fully settled parties</option>
        </select>

        <select className="sup-filter-select sup-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort suppliers">
          <option value="due_desc">Sort: Highest Due First</option>
          <option value="due_asc">Sort: Lowest Due First</option>
          <option value="name_asc">Sort: Name (A–Z)</option>
          <option value="name_desc">Sort: Name (Z–A)</option>
          <option value="purchased_desc">Sort: Highest Purchased</option>
          <option value="paid_desc">Sort: Highest Paid</option>
        </select>
      </div>

      {error && <div className="sup-error-banner">{error}</div>}

      {/* Table */}
      <div className="sup-table-wrap">
        <table className="sup-table">
          <thead>
            <tr>
              <th>Supplier Name</th>
              <th>PAN</th>
              <th>Phone</th>
              <th className="sup-col-num">Total Purchased</th>
              <th className="sup-col-num">Total Paid</th>
              <th className="sup-col-num">Balance Due</th>
              <th>Status</th>
              <th className="sup-col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {loading && [...Array(4)].map((_, i) => <SkeletonRow key={i} />)}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="sup-empty">
                  <div className="sup-empty-inner">
                    <p className="sup-empty-title">{search ? 'No suppliers match your search' : 'No suppliers yet'}</p>
                    <p className="sup-empty-body">{search ? 'Try a different name or PAN.' : 'Add your first supplier to get started.'}</p>
                    {!search && (
                      <button className="sup-empty-btn" onClick={() => { setEditTarget(null); setShowForm(true) }}>
                        <PlusIcon /> Add Supplier
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!loading && filtered.map(s => (
              <tr key={s.supplier_id} className="sup-row">
                <td>
                  <div className="sup-name-cell">
                    <div className="sup-avatar">{s.supplier_name[0]?.toUpperCase()}</div>
                    <div>
                      <div className="sup-name">{s.supplier_name}</div>
                      {s.address && <div className="sup-address">{s.address}</div>}
                    </div>
                  </div>
                </td>
                <td className="sup-td-mono">{s.supplier_pan || '—'}</td>
                <td className="sup-td-muted">{s.phone || '—'}</td>
                <td className="sup-col-num sup-td-muted">{fmtRs(s.total_purchased)}</td>
                <td className="sup-col-num sup-td-muted">{fmtRs(s.total_paid)}</td>
                <td className={`sup-col-num${parseFloat(s.balance_due) > 0 ? ' sup-td-due' : ' sup-td-muted'}`}>
                  {fmtRs(s.balance_due)}
                </td>
                <td>
                  <span className={`sup-badge${s.is_active ? ' sup-badge-active' : ' sup-badge-inactive'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="sup-col-actions">
                  <button className="sup-action-btn sup-action-btn--wa" onClick={() => shareWhatsApp(s)} title="Share WhatsApp statement">
                    <WhatsAppIcon />
                  </button>
                  <button className="sup-action-btn" onClick={() => openEdit(s)} title="Edit supplier">
                    <EditIcon />
                  </button>
                  <button className="sup-action-btn sup-action-btn--delete" onClick={() => handleDelete(s.supplier_id)} title="Deactivate supplier">
                    <DeleteIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list (visible on <768px via CSS) */}
      <div className="sup-mobile-cards">
        {!loading && filtered.map(s => (
          <div key={s.supplier_id} className="sup-mobile-card">
            <div className="sup-mobile-card-header">
              <div className="sup-name-cell">
                <div className="sup-avatar">{s.supplier_name[0]?.toUpperCase()}</div>
                <div>
                  <div className="sup-name">{s.supplier_name}</div>
                  {s.address && <div className="sup-address">{s.address}</div>}
                </div>
              </div>
              <span className={`sup-badge${s.is_active ? ' sup-badge-active' : ' sup-badge-inactive'}`}>
                {s.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="sup-mobile-card-body">
              <div>
                <span className="sup-mobile-card-label">Balance Due</span>
                <span className={`sup-mobile-card-due${parseFloat(s.balance_due) > 0 ? ' sup-td-due' : ''}`}>
                  {fmtRs(s.balance_due)}
                </span>
              </div>
              <div>
                <span className="sup-mobile-card-label">Total Purchased / Paid</span>
                <span className="sup-mobile-card-sub">{fmtRs(s.total_purchased)} / {fmtRs(s.total_paid)}</span>
              </div>
            </div>

            <div className="sup-mobile-card-footer">
              <div className="sup-mobile-card-meta">
                {s.supplier_pan && <span>PAN: {s.supplier_pan}</span>}
                {s.phone && <span>Phone: {s.phone}</span>}
              </div>

              <div className="sup-mobile-card-actions">
                <button className="sup-action-btn sup-action-btn--wa" onClick={() => shareWhatsApp(s)} title="Share WhatsApp statement">
                  <WhatsAppIcon />
                </button>
                <button className="sup-action-btn" onClick={() => openEdit(s)} title="Edit supplier">
                  <EditIcon />
                </button>
                <button className="sup-action-btn sup-action-btn--delete" onClick={() => handleDelete(s.supplier_id)} title="Deactivate supplier">
                  <DeleteIcon />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <SupplierForm
          supplier={editTarget}
          onClose={() => { setShowForm(false); setEditTarget(null) }}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}