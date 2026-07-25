import { useState, useEffect, useCallback } from 'react'
import './Suppliers.css'

const API_URL = import.meta.env.VITE_API_URL ?? ''

function fmtRs(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return 'Rs. 0'
  return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function PlusIcon()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> }
function EditIcon()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function SearchIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> }
function CloseIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg> }
function ArrowIcon()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg> }
function DeleteIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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
  const [name,     setName]     = useState(supplier?.supplier_name ?? supplier?.name ?? '')
  const [pan,      setPan]      = useState(supplier?.supplier_pan  ?? supplier?.pan  ?? '')
  const [phone,    setPhone]    = useState(supplier?.phone   ?? '')
  const [address,  setAddress]  = useState(supplier?.address ?? '')
  const [isActive, setIsActive] = useState(supplier?.is_active !== false)
  const [loading,  setLoading]  = useState(false)
  const [errs,     setErrs]     = useState({})

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
      name:      name.trim(),
      pan:       pan.trim()     || undefined,
      phone:     phone.trim()   || undefined,
      address:   address.trim() || undefined,
      is_active: isActive,
    }

    const url    = isEdit ? `${API_URL}/api/suppliers/${supplier.supplier_id ?? supplier.id}` : `${API_URL}/api/suppliers`
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
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
export default function Suppliers({ onToast }) {
  const [suppliers,   setSuppliers]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [search,      setSearch]      = useState('')
  const [showForm,    setShowForm]    = useState(false)
  const [editTarget,  setEditTarget]  = useState(null)
  const [refreshKey,  setRefreshKey]  = useState(0)
  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    setLoading(true); setError('')
    fetch(`${API_URL}/api/suppliers/balances`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => setSuppliers(j.suppliers ?? []))
      .catch(() => setError('Failed to load suppliers.'))
      .finally(() => setLoading(false))
  }, [refreshKey])

  const filtered = suppliers.filter(s =>
    !search.trim() ||
    s.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.supplier_pan ?? '').includes(search)
  )

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
    <div className="sup-page">

      {/* Header */}
      <div className="sup-header">
        <div>
          <h2 className="sup-title">Suppliers</h2>
          <p className="sup-subtitle">{suppliers.length} {suppliers.length === 1 ? 'supplier' : 'suppliers'} registered</p>
        </div>
        <button className="sup-btn-primary" onClick={() => { setEditTarget(null); setShowForm(true) }}>
          <PlusIcon /><span>Add Supplier</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="sup-summary-row">
        <div className="sup-summary-card">
          <span className="sup-summary-label">Total Purchased (all time)</span>
          <span className="sup-summary-value">{fmtRs(totalPurchased)}</span>
        </div>
        <div className="sup-summary-card sup-summary-accent">
          <span className="sup-summary-label">Outstanding Balance</span>
          <span className="sup-summary-value">{fmtRs(totalDue)}</span>
        </div>
        <div className="sup-summary-card">
          <span className="sup-summary-label">Active Suppliers</span>
          <span className="sup-summary-value">{suppliers.filter(s => s.is_active).length}</span>
        </div>
      </div>

      {/* Search */}
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