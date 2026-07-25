import { useEffect, useRef } from 'react'
import './InvoiceOverlay.css'

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtRs(val) {
  const n = parseFloat(val)
  if (isNaN(n) || n === 0) return '—'
  return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtRsForced(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return 'Rs. 0.00'
  return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(d) { return d ? String(d).slice(0, 10) : '—' }

// ── Icons ─────────────────────────────────────────────────────────────────────
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12"/>
    </svg>
  )
}
function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}
function PrintIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 6 2 18 2 18 9"/>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
      <rect x="6" y="14" width="12" height="8"/>
    </svg>
  )
}

// ── Purchase Invoice renderer ──────────────────────────────────────────────────
function PurchaseInvoiceDoc({ entry }) {
  return (
    <div className="inv-doc">
      {/* Doc Header */}
      <div className="inv-doc-header">
        <div className="inv-doc-brand">
          <div className="inv-brand-logo">V</div>
          <div>
            <div className="inv-brand-name">Vyapaar</div>
            <div className="inv-brand-sub">Purchase Management System</div>
          </div>
        </div>
        <div className="inv-doc-title-block">
          <div className="inv-doc-type">PURCHASE INVOICE</div>
          <div className="inv-doc-number">{entry.invoice_no || '—'}</div>
        </div>
      </div>

      <div className="inv-doc-divider" />

      {/* Meta row */}
      <div className="inv-meta-grid">
        <div className="inv-meta-item">
          <span className="inv-meta-label">DATE (BS)</span>
          <span className="inv-meta-value inv-mono">{entry.date_bs || '—'}</span>
        </div>
        <div className="inv-meta-item">
          <span className="inv-meta-label">DATE (AD)</span>
          <span className="inv-meta-value inv-mono">{fmtDate(entry.date_ad)}</span>
        </div>
        <div className="inv-meta-item">
          <span className="inv-meta-label">ACCOUNT HEAD</span>
          <span className="inv-meta-value">{entry.account_head || '—'}</span>
        </div>
      </div>

      {/* Supplier block */}
      <div className="inv-supplier-block">
        <div className="inv-supplier-label">SUPPLIER / VENDOR</div>
        <div className="inv-supplier-name">{entry.supplier_name || '—'}</div>
        {entry.supplier_pan && (
          <div className="inv-supplier-pan">PAN: {entry.supplier_pan}</div>
        )}
      </div>

      {/* Tax breakdown table */}
      <div className="inv-breakdown-label">TAX BREAKDOWN</div>
      <div className="inv-breakdown-table">
        <div className="inv-breakdown-header">
          <span>Category</span>
          <span className="inv-align-right">Amount</span>
        </div>
        {[
          { label: 'Tax Exempt Purchases',   val: entry.tax_exempt_purchases },
          { label: 'Taxable Purchases',       val: entry.taxable_purchases },
          { label: 'Taxable Imports',         val: entry.taxable_imports },
          { label: 'Capital Taxable Purchases', val: entry.capital_taxable_purchases },
        ].map(({ label, val }) => (
          <div key={label} className="inv-breakdown-row">
            <span>{label}</span>
            <span className="inv-align-right inv-mono">{fmtRs(val)}</span>
          </div>
        ))}
        <div className="inv-breakdown-row inv-breakdown-tax">
          <span>VAT / Tax Amount (13%)</span>
          <span className="inv-align-right inv-mono">{fmtRs(entry.tax_amount)}</span>
        </div>
        <div className="inv-breakdown-row inv-breakdown-total-val">
          <span>Total Value</span>
          <span className="inv-align-right inv-mono">{fmtRs(entry.total_value)}</span>
        </div>
      </div>

      {/* Grand total banner */}
      <div className="inv-grand-total">
        <span className="inv-grand-label">GRAND TOTAL</span>
        <span className="inv-grand-value">{fmtRsForced(entry.grand_total)}</span>
      </div>

      {/* Notes */}
      {entry.notes && (
        <div className="inv-notes-block">
          <div className="inv-notes-label">NOTES</div>
          <div className="inv-notes-text">{entry.notes}</div>
        </div>
      )}

      {/* Footer */}
      <div className="inv-doc-footer">
        <span>Generated by Vyapaar • {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        <span>Confidential Document</span>
      </div>
    </div>
  )
}

// ── Payment Voucher renderer ───────────────────────────────────────────────────
const METHOD_META = {
  cash:   { label: 'Cash',   color: '#065F46', bg: '#ECFDF5', border: '#D1FAE5' },
  online: { label: 'Online', color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' },
  cheque: { label: 'Cheque', color: '#92400E', bg: '#FFFBEB', border: '#FEF3C7' },
}

function PaymentVoucherDoc({ payment }) {
  const m = METHOD_META[payment.payment_method] ?? { label: payment.payment_method, color: '#555', bg: '#f5f5f5', border: '#ddd' }

  return (
    <div className="inv-doc">
      {/* Doc Header */}
      <div className="inv-doc-header">
        <div className="inv-doc-brand">
          <div className="inv-brand-logo">V</div>
          <div>
            <div className="inv-brand-name">Vyapaar</div>
            <div className="inv-brand-sub">Purchase Management System</div>
          </div>
        </div>
        <div className="inv-doc-title-block">
          <div className="inv-doc-type">PAYMENT VOUCHER</div>
          <div className="inv-doc-number">PMT-{String(payment.id).padStart(5, '0')}</div>
        </div>
      </div>

      <div className="inv-doc-divider" />

      {/* Meta row */}
      <div className="inv-meta-grid">
        <div className="inv-meta-item">
          <span className="inv-meta-label">DATE (BS)</span>
          <span className="inv-meta-value inv-mono">{payment.date_bs || '—'}</span>
        </div>
        <div className="inv-meta-item">
          <span className="inv-meta-label">DATE (AD)</span>
          <span className="inv-meta-value inv-mono">{fmtDate(payment.date_ad)}</span>
        </div>
        <div className="inv-meta-item">
          <span className="inv-meta-label">PAYMENT METHOD</span>
          <span
            className="inv-method-badge"
            style={{ color: m.color, background: m.bg, borderColor: m.border }}
          >
            {m.label}
          </span>
        </div>
      </div>

      {/* Supplier block */}
      <div className="inv-supplier-block">
        <div className="inv-supplier-label">PAID TO / SUPPLIER</div>
        <div className="inv-supplier-name">{payment.supplier_name || '—'}</div>
      </div>

      {/* Payment details */}
      <div className="inv-details-grid">
        {payment.invoice_no && (
          <div className="inv-detail-item">
            <span className="inv-meta-label">LINKED INVOICE</span>
            <span className="inv-meta-value inv-mono">{payment.invoice_no}</span>
          </div>
        )}
        {payment.reference_no && (
          <div className="inv-detail-item">
            <span className="inv-meta-label">{payment.payment_method === 'cheque' ? 'CHEQUE NUMBER' : 'TRANSACTION REF.'}</span>
            <span className="inv-meta-value inv-mono">{payment.reference_no}</span>
          </div>
        )}
        {!payment.invoice_no && (
          <div className="inv-detail-item">
            <span className="inv-meta-label">INVOICE</span>
            <span className="inv-meta-value" style={{ opacity: 0.5 }}>General Payment</span>
          </div>
        )}
      </div>

      {/* Grand total banner */}
      <div className="inv-grand-total">
        <span className="inv-grand-label">AMOUNT PAID</span>
        <span className="inv-grand-value">{fmtRsForced(payment.amount)}</span>
      </div>

      {/* Notes */}
      {payment.notes && (
        <div className="inv-notes-block">
          <div className="inv-notes-label">NOTES / REMARKS</div>
          <div className="inv-notes-text">{payment.notes}</div>
        </div>
      )}

      {/* Signature area */}
      <div className="inv-signature-row">
        <div className="inv-signature-slot">
          <div className="inv-signature-line" />
          <div className="inv-signature-label">Prepared By</div>
        </div>
        <div className="inv-signature-slot">
          <div className="inv-signature-line" />
          <div className="inv-signature-label">Authorized By</div>
        </div>
      </div>

      {/* Footer */}
      <div className="inv-doc-footer">
        <span>Generated by Vyapaar • {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        <span>Confidential Document</span>
      </div>
    </div>
  )
}

// ── Main overlay ───────────────────────────────────────────────────────────────
export default function InvoiceOverlay({ type, data, onClose }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [onClose])

  function handleBackdropClick(e) {
    if (e.target === overlayRef.current) onClose()
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="inv-overlay" ref={overlayRef} onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label="Invoice detail">
      <div className="inv-sheet">

        {/* Action bar (hidden when printing) */}
        <div className="inv-actions no-print">
          <div className="inv-actions-left">
            <span className="inv-actions-label">
              {type === 'purchase' ? `Invoice #${data.invoice_no}` : `Payment Voucher`}
            </span>
          </div>
          <div className="inv-actions-right">
            <button className="inv-btn-download" onClick={handlePrint} title="Download / Print PDF">
              <DownloadIcon />
              <span>Download PDF</span>
            </button>
            <button className="inv-btn-print" onClick={handlePrint} title="Print">
              <PrintIcon />
            </button>
            <button className="inv-btn-close" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Document body */}
        <div className="inv-doc-scroll">
          {type === 'purchase' && <PurchaseInvoiceDoc entry={data} />}
          {type === 'payment' && <PaymentVoucherDoc payment={data} />}
        </div>

      </div>
    </div>
  )
}
