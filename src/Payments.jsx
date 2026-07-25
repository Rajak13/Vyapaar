import { useState, useEffect, useCallback, useRef } from 'react'
import './Payments.css'
import { adToBs } from './adToBs.js'
import InvoiceOverlay from './InvoiceOverlay'

const API_URL = import.meta.env.VITE_API_URL ?? ''

function fmtRs(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return 'Rs. 0'
  return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(d) { return d ? String(d).slice(0, 10) : '—' }

// ── Icons ─────────────────────────────────────────────────────────────────────
function PlusIcon()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> }
function CloseIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg> }
function ArrowIcon()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg> }
function SearchIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> }
function DeleteIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> }

// ── Payment method badge ──────────────────────────────────────────────────────
const METHOD_META = {
  cash:   { label: 'Cash',   labelNp: 'नगद'  },
  online: { label: 'Online', labelNp: 'अनलाइन' },
  cheque: { label: 'Cheque', labelNp: 'चेक'  },
}

function MethodBadge({ method }) {
  const m = METHOD_META[method] ?? { label: method }
  return <span className={`pay-badge pay-badge-${method}`}>{m.label}</span>
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="pay-skeleton-row">
      {[...Array(7)].map((_, i) => <td key={i}><span className="pay-skeleton" style={{ width: `${45 + i * 7}%` }} /></td>)}
    </tr>
  )
}

// ── Record Payment form ───────────────────────────────────────────────────────
function PaymentForm({ suppliers, onClose, onSuccess }) {
  const [supplierId,   setSupplierId]   = useState('')
  const [invoices,     setInvoices]     = useState([])   // open invoices for selected supplier
  const [invoiceId,    setInvoiceId]    = useState('')
  const [dateAd,       setDateAd]       = useState('')
  const [dateBs,       setDateBs]       = useState('')
  const [amount,       setAmount]       = useState('')
  const [method,       setMethod]       = useState('cash')
  const [referenceNo,  setReferenceNo]  = useState('')
  const [notes,        setNotes]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [errs,         setErrs]         = useState({})
  // Overpayment guard
  const [supplierBalance,  setSupplierBalance]  = useState(null)   // { balance_due, total_purchased, total_paid }
  const [overPayConfirmed, setOverPayConfirmed] = useState(false)
  const overlayRef = useRef(null)

  // Auto-fill BS date
  useEffect(() => {
    if (!dateAd) { setDateBs(''); return }
    const bs = adToBs(dateAd)
    if (bs) setDateBs(bs)
  }, [dateAd])

  // Load open invoices when supplier changes
  useEffect(() => {
    if (!supplierId) { setInvoices([]); setInvoiceId(''); setSupplierBalance(null); return }
    fetch(`${API_URL}/api/purchase-entries?supplier_id=${supplierId}&limit=50`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { entries: [] })
      .then(j => setInvoices(j.entries ?? []))
      .catch(() => setInvoices([]))
    // Fetch balance for overpayment guard
    fetch(`${API_URL}/api/suppliers/${supplierId}/balance`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(j => setSupplierBalance(j))
      .catch(() => setSupplierBalance(null))
    setOverPayConfirmed(false)
  }, [supplierId])

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [onClose])

  function handleOverlay(e) { if (e.target === overlayRef.current) onClose() }

  function validate() {
    const e = {}
    if (!supplierId)             e.supplierId  = 'Supplier is required.'
    if (!dateAd)                 e.dateAd      = 'Date (AD) is required.'
    if (!dateBs)                 e.dateBs      = 'Date (BS) is required.'
    const a = parseFloat(amount)
    if (isNaN(a) || a <= 0)      e.amount      = 'Amount must be greater than zero.'
    if (method === 'cheque' && !referenceNo.trim()) e.referenceNo = 'Cheque number is required.'
    // Overpayment: require confirmation when amount > balance_due
    if (supplierBalance && !isNaN(a) && a > parseFloat(supplierBalance.balance_due) && !overPayConfirmed) {
      e._overpay = true
    }
    return e
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    const errors = validate()
    if (Object.keys(errors).length) { setErrs(errors); return }
    setErrs({}); setLoading(true)

    const body = {
      supplier_id:        parseInt(supplierId, 10),
      purchase_entry_id:  invoiceId ? parseInt(invoiceId, 10) : undefined,
      date_ad:            dateAd,
      date_bs:            dateBs,
      amount:             parseFloat(amount),
      payment_method:     method,
      reference_no:       referenceNo.trim() || undefined,
      notes:              notes.trim() || undefined,
    }

    try {
      const res  = await fetch(`${API_URL}/api/supplier-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setErrs({ _global: json.error ?? 'Something went wrong.' }); setLoading(false); return }
      onSuccess('Payment recorded successfully.')
      onClose()
    } catch {
      setErrs({ _global: 'Could not reach the server.' })
      setLoading(false)
    }
  }

  return (
    <div className="pay-overlay" ref={overlayRef} onClick={handleOverlay} role="dialog" aria-modal="true" aria-label="Record Payment">
      <div className="pay-panel">

        <div className="pay-panel-header">
          <h2 className="pay-panel-title">RECORD PAYMENT</h2>
          <button className="pay-panel-close" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        <div className="pay-panel-divider" />

        <form className="pay-form" onSubmit={handleSubmit} noValidate>

          {/* Supplier */}
          <div className={`pay-field${errs.supplierId ? ' pay-field-error' : ''}`}>
            <label className="pay-label" htmlFor="pay_supplier">SUPPLIER <span className="pay-req">*</span></label>
            <select
              className={`pay-select${errs.supplierId ? ' pay-input-error' : ''}`}
              id="pay_supplier"
              value={supplierId}
              onChange={e => { setSupplierId(e.target.value); setInvoiceId('') }}
            >
              <option value="">Select supplier…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {errs.supplierId && <span className="pay-field-msg">{errs.supplierId}</span>}
          </div>

          {/* Optional: tie to specific invoice */}
          {invoices.length > 0 && (
            <div className="pay-field">
              <label className="pay-label" htmlFor="pay_invoice">AGAINST INVOICE (OPTIONAL)</label>
              <select className="pay-select" id="pay_invoice" value={invoiceId} onChange={e => setInvoiceId(e.target.value)}>
                <option value="">General payment (not tied to invoice)</option>
                {invoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_no} — {fmtRs(inv.grand_total)} ({fmtDate(inv.date_ad)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date row */}
          <div className="pay-row">
            <div className={`pay-field${errs.dateAd ? ' pay-field-error' : ''}`}>
              <label className="pay-label" htmlFor="pay_date_ad">DATE (AD) <span className="pay-req">*</span></label>
              <input className={`pay-input${errs.dateAd ? ' pay-input-error' : ''}`} id="pay_date_ad" type="date" value={dateAd} onChange={e => setDateAd(e.target.value)} />
              {errs.dateAd && <span className="pay-field-msg">{errs.dateAd}</span>}
            </div>
            <div className={`pay-field${errs.dateBs ? ' pay-field-error' : ''}`}>
              <label className="pay-label" htmlFor="pay_date_bs">DATE (BS) <span className="pay-req">*</span></label>
              <input className={`pay-input${errs.dateBs ? ' pay-input-error' : ''}`} id="pay_date_bs" type="text" placeholder="e.g. 2081-04-15" value={dateBs} onChange={e => setDateBs(e.target.value)} />
              {errs.dateBs && <span className="pay-field-msg">{errs.dateBs}</span>}
            </div>
          </div>

          {/* Amount */}
          <div className={`pay-field${errs.amount ? ' pay-field-error' : ''}`}>
            <label className="pay-label" htmlFor="pay_amount">
              AMOUNT (Rs.) <span className="pay-req">*</span>
              {supplierBalance && (
                <span className="pay-balance-hint">
                  Outstanding: {fmtRs(supplierBalance.balance_due)}
                </span>
              )}
            </label>
            <input className={`pay-input${errs.amount ? ' pay-input-error' : ''}`} id="pay_amount" type="number" min="0.01" step="0.01" placeholder="0.00" value={amount} onChange={e => { setAmount(e.target.value); setOverPayConfirmed(false) }} />
            {errs.amount && <span className="pay-field-msg">{errs.amount}</span>}
            {/* Overpayment warning */}
            {supplierBalance && !isNaN(parseFloat(amount)) && parseFloat(amount) > parseFloat(supplierBalance.balance_due) && (
              <div className="pay-overpay-warn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span>This exceeds the outstanding balance of <strong>{fmtRs(supplierBalance.balance_due)}</strong>.</span>
                <label className="pay-overpay-confirm">
                  <input type="checkbox" checked={overPayConfirmed} onChange={e => setOverPayConfirmed(e.target.checked)} />
                  <span>Record anyway</span>
                </label>
              </div>
            )}
          </div>

          {/* Payment method — 3 option pills */}
          <div className="pay-field">
            <label className="pay-label">PAYMENT METHOD <span className="pay-req">*</span></label>
            <div className="pay-method-group" role="radiogroup" aria-label="Payment method">
              {['cash', 'online', 'cheque'].map(m => (
                <label key={m} className={`pay-method-pill${method === m ? ' active' : ''}`}>
                  <input
                    type="radio" name="pay_method" value={m}
                    checked={method === m}
                    onChange={() => setMethod(m)}
                    className="pay-method-radio"
                  />
                  <span className="pay-method-icon" aria-hidden="true">
                    {m === 'cash'   && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/><path d="M6 12H4M20 12h-2"/></svg>}
                    {m === 'online' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>}
                    {m === 'cheque' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h4M6 14h6"/></svg>}
                  </span>
                  {METHOD_META[m].label}
                </label>
              ))}
            </div>
          </div>

          {/* Reference number — required for cheque, optional for online */}
          {(method === 'cheque' || method === 'online') && (
            <div className={`pay-field${errs.referenceNo ? ' pay-field-error' : ''}`}>
              <label className="pay-label" htmlFor="pay_ref">
                {method === 'cheque' ? 'CHEQUE NUMBER' : 'TRANSACTION REFERENCE'}
                {method === 'cheque' && <span className="pay-req"> *</span>}
              </label>
              <input
                className={`pay-input${errs.referenceNo ? ' pay-input-error' : ''}`}
                id="pay_ref" type="text"
                placeholder={method === 'cheque' ? 'e.g. 001234' : 'e.g. TXN12345678'}
                value={referenceNo}
                onChange={e => setReferenceNo(e.target.value)}
              />
              {errs.referenceNo && <span className="pay-field-msg">{errs.referenceNo}</span>}
            </div>
          )}

          {/* Notes */}
          <div className="pay-field">
            <label className="pay-label" htmlFor="pay_notes">NOTES (OPTIONAL)</label>
            <textarea className="pay-input pay-textarea" id="pay_notes" rows={2} placeholder="Any remarks…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {errs._global && <p className="pay-global-error" role="alert">{errs._global}</p>}
          {errs._overpay && (
            <p className="pay-global-error" role="alert">Tick "Record anyway" to confirm this overpayment.</p>
          )}

          <button className="pay-submit" type="submit" disabled={loading}>
            <span>RECORD PAYMENT</span>
            {loading ? <span className="pay-spinner" aria-hidden="true" /> : <ArrowIcon />}
          </button>

        </form>
      </div>
    </div>
  )
}

// ── Main Payments page ────────────────────────────────────────────────────────
export default function Payments({ onToast }) {
  const [payments,    setPayments]    = useState([])
  const [total,       setTotal]       = useState(0)
  const [stats,       setStats]       = useState(null)
  const [suppliers,   setSuppliers]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [suppFilter,  setSuppFilter]  = useState('')
  const [showForm,    setShowForm]    = useState(false)
  const [refreshKey,  setRefreshKey]  = useState(0)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  // Load supplier list for filter + form
  useEffect(() => {
    fetch(`${API_URL}/api/suppliers`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { suppliers: [] })
      .then(j => setSuppliers(j.suppliers ?? []))
      .catch(() => {})
  }, [])

  // Load payments + stats
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: 50 })
    if (suppFilter) params.set('supplier_id', suppFilter)

    Promise.all([
      fetch(`${API_URL}/api/supplier-payments?${params}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch(`${API_URL}/api/supplier-payments/stats`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    ])
      .then(([payData, statsData]) => {
        if (payData) { setPayments(payData.payments ?? []); setTotal(payData.total ?? 0) }
        if (statsData) setStats(statsData)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [suppFilter, refreshKey])

  const filtered = payments.filter(p => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      p.supplier_name?.toLowerCase().includes(q) ||
      p.reference_no?.toLowerCase().includes(q) ||
      p.invoice_no?.toLowerCase().includes(q)
    )
  })

  function handleSuccess(msg) {
    setShowForm(false)
    refresh()
    if (onToast) onToast(msg, 'success')
  }

  function handleDeletePayment(id) {
    if (!window.confirm('Delete this payment record? This cannot be undone.')) return
    fetch(`${API_URL}/api/supplier-payments/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
      .then(async res => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error ?? 'Failed to delete payment')
        }
      })
      .then(() => {
        refresh()
        if (onToast) onToast('Payment deleted.', 'success')
      })
      .catch(err => {
        if (onToast) onToast(err.message || 'Failed to delete payment', 'error')
      })
  }

  return (
    <div className="pay-page">

      {/* Header */}
      <div className="pay-header">
        <div>
          <h2 className="pay-title">Payments</h2>
          <p className="pay-subtitle">{total} payment{total !== 1 ? 's' : ''} recorded</p>
        </div>
        <button className="pay-btn-primary" onClick={() => setShowForm(true)}>
          <PlusIcon /><span>Record Payment</span>
        </button>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="pay-stats-row">
          <div className="pay-stat-card pay-stat-accent">
            <span className="pay-stat-label">Total Paid (All Time)</span>
            <span className="pay-stat-value">{fmtRs(stats.total_paid)}</span>
          </div>
          <div className="pay-stat-card">
            <span className="pay-stat-label">Cash Payments</span>
            <span className="pay-stat-value">{fmtRs(stats.paid_cash)}</span>
          </div>
          <div className="pay-stat-card">
            <span className="pay-stat-label">Online Transfers</span>
            <span className="pay-stat-value">{fmtRs(stats.paid_online)}</span>
          </div>
          <div className="pay-stat-card">
            <span className="pay-stat-label">Cheque Payments</span>
            <span className="pay-stat-value">{fmtRs(stats.paid_cheque)}</span>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="pay-toolbar">
        <div className="pay-search-wrap">
          <SearchIcon />
          <input
            className="pay-search-input"
            type="text"
            placeholder="Search by supplier, invoice, or reference…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="pay-search-clear" onClick={() => setSearch('')}>×</button>}
        </div>
        <select className="pay-filter-select" value={suppFilter} onChange={e => { setSuppFilter(e.target.value) }}>
          <option value="">All suppliers</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="pay-table-wrap">
        <table className="pay-table">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Date (BS)</th>
              <th>Date (AD)</th>
              <th>Method</th>
              <th>Reference</th>
              <th>Invoice</th>
              <th className="pay-col-num">Amount</th>
              <th className="pay-col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {loading && [...Array(4)].map((_, i) => <SkeletonRow key={i} />)}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="pay-empty">
                  <div className="pay-empty-inner">
                    <p className="pay-empty-title">{search || suppFilter ? 'No payments match your filters' : 'No payments recorded yet'}</p>
                    <p className="pay-empty-body">{search || suppFilter ? 'Try adjusting your filters.' : 'Record your first supplier payment to get started.'}</p>
                    {!search && !suppFilter && (
                      <button className="pay-empty-btn" onClick={() => setShowForm(true)}>
                        <PlusIcon /> Record Payment
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!loading && filtered.map(p => (
              <tr key={p.id} className="pay-row pay-row-clickable" onClick={() => setSelectedPayment(p)}>
                <td>
                  <div className="pay-supplier-cell">
                    <div className="pay-avatar">{p.supplier_name?.[0]?.toUpperCase()}</div>
                    <span className="pay-supplier-name">{p.supplier_name}</span>
                  </div>
                </td>
                <td className="pay-td-muted">{p.date_bs || '—'}</td>
                <td className="pay-td-muted">{fmtDate(p.date_ad)}</td>
                <td><MethodBadge method={p.payment_method} /></td>
                <td className="pay-td-mono">{p.reference_no || '—'}</td>
                <td className="pay-td-muted">{p.invoice_no || <span style={{ opacity: 0.4 }}>General</span>}</td>
                <td className="pay-col-num pay-td-amount">{fmtRs(p.amount)}</td>
                <td className="pay-col-actions" onClick={e => e.stopPropagation()}>
                  <button
                    className="pay-action-btn pay-action-btn--delete"
                    title="Delete payment"
                    onClick={() => handleDeletePayment(p.id)}
                  >
                    <DeleteIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <PaymentForm
          suppliers={suppliers}
          onClose={() => setShowForm(false)}
          onSuccess={handleSuccess}
        />
      )}

      {selectedPayment && (
        <InvoiceOverlay
          type="payment"
          data={selectedPayment}
          onClose={() => setSelectedPayment(null)}
        />
      )}
    </div>
  )
}
