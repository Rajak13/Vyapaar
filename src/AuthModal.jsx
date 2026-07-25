import { useState, useEffect, useRef } from 'react'
import './AuthModal.css'

const API_URL = import.meta.env.VITE_API_URL ?? ''

export default function AuthModal({ initialTab = 'login', onClose, onSuccess }) {
  const [tab, setTab] = useState(initialTab)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const overlayRef = useRef(null)

  // Sync tab when parent changes initialTab (e.g. Register button → opens on register)
  useEffect(() => { setTab(initialTab); setError('') }, [initialTab])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Trap scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form))

    // Basic client-side validation
    if (tab === 'register' && data.password !== data.confirm_password) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    const endpoint = tab === 'login' ? '/auth/login' : '/auth/register'

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // send/receive httpOnly cookie
        body: JSON.stringify(
          tab === 'login'
            ? { email: data.email, password: data.password }
            : { email: data.email, password: data.password, full_name: data.full_name }
        ),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(json.error ?? 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      // Close modal first, then update app state — avoids calling setModal
      // on an already-unmounted component when App switches to Dashboard.
      onClose()
      onSuccess(
        tab === 'login' ? 'Welcome back!' : 'Account created! Welcome to Vyapaar.',
        json.user
      )
    } catch {
      setError('Could not reach the server. Check your connection.')
      setLoading(false)
    }
  }

  return (
    <div
      className="auth-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={tab === 'login' ? 'Log in' : 'Create account'}
    >
      <div className="auth-panel">
        {/* Header */}
        <div className="auth-panel-header">
          <h2 className="auth-title">
            {tab === 'login' ? 'LOG IN' : 'REGISTER'}
          </h2>
          <button className="auth-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="auth-divider" />

        {/* Tab switcher */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError('') }}
            type="button"
          >
            Log in
          </button>
          <button
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); setError('') }}
            type="button"
          >
            Create account
          </button>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>

          {tab === 'register' && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="full_name">
                FULL NAME
              </label>
              <input
                className="auth-input"
                id="full_name"
                name="full_name"
                type="text"
                placeholder="Your full name"
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label" htmlFor="email">
              EMAIL
            </label>
            <input
              className="auth-input"
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete={tab === 'login' ? 'username' : 'email'}
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="password">
              PASSWORD
            </label>
            <input
              className="auth-input"
              id="password"
              name="password"
              type="password"
              placeholder={tab === 'login' ? 'Your password' : 'Min. 8 characters'}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
              required
            />
          </div>

          {tab === 'register' && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="confirm_password">
                CONFIRM PASSWORD
              </label>
              <input
                className="auth-input"
                id="confirm_password"
                name="confirm_password"
                type="password"
                placeholder="Repeat password"
                autoComplete="new-password"
                required
              />
            </div>
          )}

          {error && (
            <p className="auth-error" role="alert">{error}</p>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            <span>{tab === 'login' ? 'LOG IN' : 'CREATE ACCOUNT'}</span>
            {loading
              ? <span className="auth-spinner" aria-hidden="true" />
              : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              )
            }
          </button>
        </form>

        {/* Footer switch */}
        <p className="auth-switch">
          {tab === 'login' ? "Don't have an account?" : 'Already have an account?'}
          {' '}
          <button
            type="button"
            className="auth-switch-btn"
            onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError('') }}
          >
            {tab === 'login' ? 'Register' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  )
}
