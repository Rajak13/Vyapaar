import { useState, useEffect, useRef } from 'react'
import './PurchaseEntryForm.css'
import { adToBs } from './adToBs.js'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')


// ── Field label translations (English / Nepali) ───────────────────────────────
const LABELS = {
  en: {
    title_new:        'NEW PURCHASE ENTRY',
    title_edit:       'EDIT ENTRY',
    lang_toggle:      'नेपाली',
    date_ad:          'DATE (AD)',
    date_bs:          'DATE (BS)',
    invoice_no:       'INVOICE / BILL NO.',
    supplier:         'SUPPLIER',
    account_head:     'ACCOUNT HEAD (OPTIONAL)',
    values_section:   'PURCHASE VALUES',
    tax_exempt:       'TAX EXEMPT PURCHASES (Rs.)',
    taxable:          'TAXABLE PURCHASES (Rs.)',
    tax_imports:      'TAXABLE IMPORTS (Rs.)',
    capital_taxable:  'CAPITAL TAXABLE PURCHASES (Rs.)',
    tax_amount:       'TAX AMOUNT (Rs.)',
    auto_tax:         'Auto 13%',
    total_value:      'Total Value',
    grand_total:      'Grand Total (incl. tax)',
    notes:            'NOTES (OPTIONAL)',
    submit_add:       'ADD ENTRY',
    submit_edit:      'SAVE CHANGES',
  },
  np: {
    title_new:        'नयाँ खरिद प्रविष्टि',
    title_edit:       'प्रविष्टि सम्पादन',
    lang_toggle:      'English',
    date_ad:          'मिति (इसवी)',
    date_bs:          'मिति (बि.सं.)',
    invoice_no:       'बिजक / प्रज्ञापन पत्र नम्बर',
    supplier:         'आपूर्तिकर्ता',
    account_head:     'खाता (ऐच्छिक)',
    values_section:   'खरिद विवरण',
    tax_exempt:       'कर छुट हुने वस्तु तथा सेवाको खरिद/पैठारी (रू.)',
    taxable:          'कर योग्य खरिद (पूँजीगत बाहेक) (रू.)',
    tax_imports:      'कर योग्य पैठारी (पूँजीगत बाहेक) (रू.)',
    capital_taxable:  'पूँजीगत कर योग्य खरिद/पैठारी (रू.)',
    tax_amount:       'कर रकम (रू.)',
    auto_tax:         'स्वतः १३%',
    total_value:      'जम्मा खरिद',
    grand_total:      'कुल जम्मा (कर सहित)',
    notes:            'कैफियत (ऐच्छिक)',
    submit_add:       'प्रविष्टि थप्नुहोस्',
    submit_edit:      'परिवर्तन सुरक्षित गर्नुहोस्',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toNum(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n }

// ── Field with inline error ───────────────────────────────────────────────────
function Field({ label, htmlFor, error, required, children }) {
  return (
    <div className={`pef-field${error ? ' pef-field-error' : ''}`}>
      <label className="pef-label" htmlFor={htmlFor}>
        {label}{required && <span className="pef-required" aria-hidden="true"> *</span>}
      </label>
      {children}
      {error && <span className="pef-field-msg" role="alert">{error}</span>}
    </div>
  )
}

function NumInput({ id, value, onChange, error }) {
  return (
    <input
      className={`pef-input${error ? ' pef-input-error' : ''}`}
      id={id} type="number" min="0" step="0.01"
      value={value} onChange={onChange} placeholder="0.00"
    />
  )
}

// ── Supplier typeahead ────────────────────────────────────────────────────────
function SupplierSearch({ selected, onSelect, error }) {
  const [query,   setQuery]   = useState(selected?.name ?? '')
  const [options, setOptions] = useState([])
  const [open,    setOpen]    = useState(false)
  const wrapRef  = useRef(null)
  const timerRef = useRef(null)
  const allRef   = useRef([])

  useEffect(() => {
    fetch(`${API_URL}/api/suppliers`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { suppliers: [] })
      .then(j => { allRef.current = j.suppliers ?? [] })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function handleInput(e) {
    const q = e.target.value
    setQuery(q); onSelect(null)
    clearTimeout(timerRef.current)
    if (!q.trim()) { setOptions([]); setOpen(false); return }
    timerRef.current = setTimeout(() => {
      setOptions(allRef.current.filter(s => s.name.toLowerCase().includes(q.toLowerCase())))
      setOpen(true)
    }, 150)
  }

  function pick(s) { setQuery(s.name); onSelect(s); setOpen(false) }
  function addNew() { onSelect({ name: query.trim(), isNew: true }); setOpen(false) }

  return (
    <div className="pef-supplier-wrap" ref={wrapRef}>
      <input
        className={`pef-input${error ? ' pef-input-error' : ''}`}
        id="supplier" type="text"
        placeholder="Type to search or add new…"
        value={query} onChange={handleInput}
        onFocus={() => { if (query) setOpen(true) }}
        autoComplete="off" aria-autocomplete="list" aria-expanded={open}
      />
      {open && (
        <div className="pef-dropdown" role="listbox">
          {options.map(s => (
            <button key={s.id} type="button" className="pef-dropdown-item" onClick={() => pick(s)}>
              <span className="pef-dropdown-name">{s.name}</span>
              {s.pan && <span className="pef-dropdown-meta">PAN: {s.pan}</span>}
            </button>
          ))}
          {query.trim() && (
            <button type="button" className="pef-dropdown-item pef-dropdown-add" onClick={addNew}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
              Add "{query.trim()}" as new supplier
            </button>
          )}
          {options.length === 0 && query.trim() && (
            <div className="pef-dropdown-empty">No match — use "Add" below</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────
export default function PurchaseEntryForm({ onClose, onSuccess, initialData }) {
  const overlayRef = useRef(null)
  const isEdit = Boolean(initialData?.id)

  // Language toggle
  const [lang, setLang] = useState('en')
  const L = LABELS[lang]

  const [showAdvanced, setShowAdvanced] = useState(false)

  // Supplier state — { id, name } for existing, { name, isNew: true } for new
  const [supplier, setSupplier] = useState(
    initialData?.supplier_id
      ? { id: initialData.supplier_id, name: initialData.supplier_name ?? '' }
      : null
  )

  const todayStr = new Date().toISOString().slice(0, 10)
  const [dateAd,         setDateAd]         = useState(initialData?.date_ad?.slice(0,10) ?? todayStr)
  const [dateBs,         setDateBs]         = useState(initialData?.date_bs ?? (adToBs(todayStr) || ''))
  const [invoiceNo,      setInvoiceNo]      = useState(initialData?.invoice_no ?? '')
  const [accountHead,    setAccountHead]    = useState(initialData?.account_head ?? '')
  const [taxExempt,      setTaxExempt]      = useState(initialData?.tax_exempt_purchases ?? '')
  const [taxable,        setTaxable]        = useState(initialData?.taxable_purchases ?? '')
  const [taxImports,     setTaxImports]     = useState(initialData?.taxable_imports ?? '')
  const [capitalTaxable, setCapitalTaxable] = useState(initialData?.capital_taxable_purchases ?? '')
  const [taxAmount,      setTaxAmount]      = useState(initialData?.tax_amount ?? '')
  const [autoTax,        setAutoTax]        = useState(!initialData)
  const [notes,          setNotes]          = useState(initialData?.notes ?? '')
  const [loading,        setLoading]        = useState(false)
  const [errs,           setErrs]           = useState({})

  // Auto-fill BS date when AD date changes
  useEffect(() => {
    if (!dateAd) return
    const bs = adToBs(dateAd)
    if (bs) setDateBs(bs)
  }, [dateAd])

  // Auto-calculate 13% tax
  useEffect(() => {
    if (!autoTax) return
    const base = toNum(taxable) + toNum(taxImports) + toNum(capitalTaxable)
    setTaxAmount((base * 0.13).toFixed(2))
  }, [autoTax, taxable, taxImports, capitalTaxable])

  const totalValue = toNum(taxExempt) + toNum(taxable) + toNum(taxImports) + toNum(capitalTaxable)
  const grandTotal = totalValue + toNum(taxAmount)

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [onClose])

  function handleOverlay(e) { if (e.target === overlayRef.current) onClose() }

  function validate() {
    const e = {}
    if (!dateAd)                 e.dateAd    = lang === 'np' ? 'मिति (इसवी) अनिवार्य छ।' : 'Date (AD) is required.'
    if (!supplier?.name?.trim()) e.supplier  = lang === 'np' ? 'आपूर्तिकर्ता अनिवार्य छ।' : 'Supplier is required.'
    if (totalValue <= 0)         e.values    = lang === 'np' ? 'कम्तीमा एक खरिद मूल्य भर्नुहोस्।' : 'At least one purchase value must be greater than zero.'
    const checks = { taxExempt, taxable, taxImports, capitalTaxable, taxAmount }
    for (const [k, v] of Object.entries(checks)) {
      if (v !== '' && (isNaN(parseFloat(v)) || parseFloat(v) < 0)) e[k] = lang === 'np' ? 'ऋणात्मक हुन सक्दैन।' : 'Must be a non-negative number.'
    }
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = validate()
    if (Object.keys(errors).length > 0) { setErrs(errors); return }
    setErrs({}); setLoading(true)

    // Auto-generate bill/invoice number if left blank in Quick Mode
    const finalInvoiceNo = invoiceNo.trim() || `BILL-${(dateBs || dateAd).replace(/\D/g, '')}-${Math.floor(100 + Math.random() * 900)}`

    const body = {
      date_ad:                   dateAd,
      date_bs:                   dateBs || dateAd,
      invoice_no:                finalInvoiceNo,
      account_head:              accountHead.trim() || undefined,
      tax_exempt_purchases:      toNum(taxExempt),
      taxable_purchases:         toNum(taxable),
      taxable_imports:           toNum(taxImports),
      capital_taxable_purchases: toNum(capitalTaxable),
      tax_amount:                toNum(taxAmount),
      notes:                     notes.trim() || undefined,
      ...(supplier?.id ? { supplier_id: supplier.id } : { supplier_name: supplier?.name }),
    }

    const url    = isEdit ? `${API_URL}/api/purchase-entries/${initialData.id}` : `${API_URL}/api/purchase-entries`
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setErrs({ _global: json.error ?? 'Something went wrong.' }); setLoading(false); return }
      onSuccess(isEdit ? 'Entry updated.' : 'Purchase entry added successfully.')
      onClose()
    } catch {
      setErrs({ _global: 'Could not reach the server. Check your connection.' })
      setLoading(false)
    }
  }

  return (
    <div className="pef-overlay" ref={overlayRef} onClick={handleOverlay} role="dialog" aria-modal="true">
      <div className="pef-panel">

        <div className="pef-header">
          <h2 className="pef-title">{isEdit ? L.title_edit : L.title_new}</h2>
          <div className="pef-header-right">
            {/* Language toggle */}
            <button
              type="button"
              className="pef-lang-toggle"
              onClick={() => setLang(l => l === 'en' ? 'np' : 'en')}
              title="Switch language"
            >
              {L.lang_toggle}
            </button>
            <button className="pef-close" onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div className="pef-divider" />

        <form className="pef-form" onSubmit={handleSubmit} noValidate>

          {/* Supplier (Primary Quick Entry Input) */}
          <Field label={L.supplier} htmlFor="supplier" error={errs.supplier} required>
            <SupplierSearch selected={supplier} onSelect={setSupplier} error={errs.supplier} />
          </Field>

          {/* Primary Purchase Amount (Quick Entry) */}
          <Field label={L.taxable} htmlFor="taxable" error={errs.taxable} required>
            <NumInput id="taxable" value={taxable} onChange={e => setTaxable(e.target.value)} error={errs.taxable} />
          </Field>

          {/* Date row — AD auto-converts to BS */}
          <div className="pef-row">
            <Field label={L.date_ad} htmlFor="date_ad" error={errs.dateAd} required>
              <input className={`pef-input${errs.dateAd ? ' pef-input-error' : ''}`} id="date_ad" type="date" value={dateAd} onChange={e => setDateAd(e.target.value)} />
            </Field>
            <Field label={L.date_bs} htmlFor="date_bs">
              <input
                className="pef-input pef-input-readonly"
                id="date_bs" type="text"
                value={dateBs}
                onChange={e => setDateBs(e.target.value)}
                placeholder="Auto-filled BS date"
              />
            </Field>
          </div>

          <div className="pef-tax-row">
            <Field label={L.tax_amount} htmlFor="tax_amount" error={errs.taxAmount}>
              <NumInput id="tax_amount" value={taxAmount} onChange={e => { setAutoTax(false); setTaxAmount(e.target.value) }} error={errs.taxAmount} />
            </Field>
            <label className="pef-autotax-toggle">
              <input type="checkbox" checked={autoTax} onChange={e => setAutoTax(e.target.checked)} />
              <span>{L.auto_tax}</span>
            </label>
          </div>

          {/* Advanced accordion toggle */}
          <button
            type="button"
            className="pef-adv-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <span>{showAdvanced ? '− Hide Invoice & Extra Details' : '＋ Add Invoice No, Exempt & Notes'}</span>
          </button>

          {showAdvanced && (
            <div className="pef-adv-box">
              <Field label={L.invoice_no} htmlFor="invoice_no" error={errs.invoiceNo}>
                <input className="pef-input" id="invoice_no" type="text" placeholder="Auto-generated if left empty" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
              </Field>

              <Field label={L.account_head} htmlFor="account_head">
                <input className="pef-input" id="account_head" type="text" placeholder="e.g. Office Supplies" value={accountHead} onChange={e => setAccountHead(e.target.value)} />
              </Field>

              <div className="pef-row">
                <Field label={L.tax_exempt} htmlFor="tax_exempt" error={errs.taxExempt}>
                  <NumInput id="tax_exempt" value={taxExempt} onChange={e => setTaxExempt(e.target.value)} error={errs.taxExempt} />
                </Field>
                <Field label={L.tax_imports} htmlFor="tax_imports" error={errs.taxImports}>
                  <NumInput id="tax_imports" value={taxImports} onChange={e => setTaxImports(e.target.value)} error={errs.taxImports} />
                </Field>
              </div>

              <Field label={L.capital_taxable} htmlFor="capital_taxable" error={errs.capitalTaxable}>
                <NumInput id="capital_taxable" value={capitalTaxable} onChange={e => setCapitalTaxable(e.target.value)} error={errs.capitalTaxable} />
              </Field>
            </div>
          )}

          {/* Live totals */}
          <div className="pef-totals">
            <div className="pef-total-row">
              <span>{L.total_value}</span>
              <span>Rs. {totalValue.toFixed(2)}</span>
            </div>
            <div className="pef-total-row pef-total-grand">
              <span>{L.grand_total}</span>
              <span>Rs. {grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <Field label={L.notes} htmlFor="notes">
            <textarea className="pef-input pef-textarea" id="notes" rows={2} placeholder={lang === 'np' ? 'कैफियत…' : 'Any remarks…'} value={notes} onChange={e => setNotes(e.target.value)} />
          </Field>

          {errs._global && <p className="pef-error" role="alert">{errs._global}</p>}

          <button className="pef-submit" type="submit" disabled={loading}>
            <span>{isEdit ? L.submit_edit : L.submit_add}</span>
            {loading
              ? <span className="pef-spinner" aria-hidden="true" />
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            }
          </button>

        </form>
      </div>
    </div>
  )
}
