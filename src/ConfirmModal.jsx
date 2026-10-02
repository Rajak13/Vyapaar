import { useEffect } from 'react'
import './ConfirmModal.css'

function AlertTriangleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export default function ConfirmModal({
  isOpen,
  title = 'Confirm Action',
  subtitle,
  message,
  callout,
  details = [],
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger', // 'danger' | 'warning'
  loading = false,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, loading, onClose])

  if (!isOpen) return null

  return (
    <div
      className="cfm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cfm-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose()
      }}
    >
      <div className="cfm-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cfm-header">
          <div className={`cfm-icon-bubble cfm-icon-bubble--${confirmVariant}`}>
            {confirmVariant === 'warning' ? <AlertTriangleIcon /> : <TrashIcon />}
          </div>
          <button
            type="button"
            className="cfm-close-btn"
            onClick={onClose}
            disabled={loading}
            aria-label="Close dialog"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="cfm-content">
          <h2 id="cfm-dialog-title" className="cfm-title">
            {title}
          </h2>
          {subtitle && <p className="cfm-subtitle">{subtitle}</p>}
          {message && <p className="cfm-message">{message}</p>}

          {/* Key-Value Details */}
          {details.length > 0 && (
            <div className="cfm-details-box">
              {details.map((d, i) => (
                <div key={i} className="cfm-detail-row">
                  <span className="cfm-detail-label">{d.label}</span>
                  <span className="cfm-detail-val">{d.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Callout Notice */}
          {callout && (
            <div className={`cfm-callout cfm-callout--${confirmVariant}`}>
              {callout}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="cfm-actions">
          <button
            type="button"
            className="cfm-btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`cfm-btn-confirm cfm-btn-confirm--${confirmVariant}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="cfm-spinner" aria-hidden="true" />
                <span>Processing…</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
