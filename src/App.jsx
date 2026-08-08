import { useState, useEffect, lazy, Suspense } from 'react'
import './App.css'
import AuthModal from './AuthModal'
import Toast from './Toast'
import { queryClient } from './queryClient'
import Terms from './Terms'
import Privacy from './Privacy'

// Code-split the post-login app — a logged-out visitor on the landing page
// shouldn't download any of this code.
const Dashboard = lazy(() => import('./Dashboard'))

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

const RIBBON_TEXT = 'Leave the boring stuff to us  \u00B7  Vyapaar  \u00B7  '

function Ribbon() {
  return (
    <svg
      className="ribbon"
      viewBox="0 0 1500 1000"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <path
        id="ribbonPath"
        d="M 920 780 C 1080 720 1240 670 1380 640"
        fill="none"
        stroke="var(--orange)"
        strokeWidth="44"
        strokeLinecap="round"
      />
      <text className="ribbon-text" fill="var(--ink)">
        <textPath href="#ribbonPath" startOffset="2%">
          {RIBBON_TEXT.repeat(2)}
        </textPath>
      </text>
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" strokeLinecap="round" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

function UserPlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10" cy="8" r="4" />
      <path d="M2 20c0-4 3.6-7 8-7s8 3 8 7" />
      <path d="M19 8v6M16 11h6" />
    </svg>
  )
}

function AppLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg, #0f0f0f)' }}>
      <span className="auth-spinner" aria-label="Loading…" style={{ width: 32, height: 32, borderWidth: 3 }} />
    </div>
  )
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('vyapaar_theme') || 'dark'
  })
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)
  const [user, setUser] = useState(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [hash, setHash] = useState(() => window.location.hash)

  const [hasSessionHint] = useState(() => localStorage.getItem('vyapaar_has_session') === 'true')

  // Track hash changes for client-side routing
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function handleThemeChange(newTheme) {
    setTheme(newTheme)
    localStorage.setItem('vyapaar_theme', newTheme)
  }

  // On page load, check if a valid session cookie or token exists in the background.
  useEffect(() => {
    const localToken = localStorage.getItem('vyapaaar_token')

    // Helper: parse user from JWT payload without verifying signature (client-side only)
    function parseJwtUser(token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (!payload?.sub) return null
        // Check expiry
        if (payload.exp && payload.exp * 1000 < Date.now()) return null
        return { id: payload.sub, email: payload.email, full_name: payload.full_name }
      } catch { return null }
    }

    // If we have a local token that hasn't expired yet, optimistically restore user
    // immediately so dashboard loads without waiting for the network.
    if (localToken) {
      const optimisticUser = parseJwtUser(localToken)
      if (optimisticUser) {
        setUser(optimisticUser)
        setSessionChecked(true)
      }
    }

    const headers = localToken ? { Authorization: `Bearer ${localToken}` } : {}
    fetch(`${API_URL}/auth/me`, { credentials: 'include', headers })
      .then(r => {
        if (r.status === 401 || r.status === 403) {
          // Genuine auth rejection — clear stored session
          localStorage.removeItem('vyapaar_has_session')
          localStorage.removeItem('vyapaaar_token')
          setUser(null)
          return null
        }
        return r.ok ? r.json() : null
      })
      .then(data => {
        if (data?.user) {
          localStorage.setItem('vyapaar_has_session', 'true')
          if (data.token) localStorage.setItem('vyapaaar_token', data.token)
          setUser(data.user)
        }
      })
      .catch(() => {
        // Network error (e.g. Render cold-starting) — keep optimistic user if we set one.
        // Don't clear the session — the token may still be valid once server wakes up.
      })
      .finally(() => setSessionChecked(true))
  }, [])

  // If a returning user logged in previously, show a clean loader while verifying session.
  // Logged-out visitors render the landing page instantly (<50ms)!
  if (hasSessionHint && !sessionChecked) {
    return <AppLoader />
  }

  // ── Legal pages — accessible without login, no auth required ──
  function handleLegalBack() {
    window.location.hash = ''
    setHash('')
  }
  if (hash === '#terms') {
    return <Terms theme={theme} onBack={handleLegalBack} />
  }
  if (hash === '#privacy') {
    return <Privacy theme={theme} onBack={handleLegalBack} />
  }

  function openModal(tab) { setModal(tab) }
  function closeModal()   { setModal(null) }

  function showToast(message, type = 'success') {
    setToast({ message, type })
  }

  // Called by AuthModal on success
  function handleAuthSuccess(msg, loggedInUser, token) {
    localStorage.setItem('vyapaar_has_session', 'true')
    if (token) localStorage.setItem('vyapaaar_token', token)
    queryClient.clear()
    setUser(loggedInUser)
    showToast(msg, 'success')
  }

  function handleLogout() {
    const localToken = localStorage.getItem('vyapaaar_token')
    const headers = localToken ? { Authorization: `Bearer ${localToken}` } : {}
    fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include', headers })
    localStorage.removeItem('vyapaar_has_session')
    localStorage.removeItem('vyapaaar_token')
    sessionStorage.removeItem('vyapaar_nav')
    queryClient.clear()
    setUser(null)
    showToast('You have been logged out.', 'success')
  }

  // If authenticated, show the dashboard instead of the landing page
  if (user) {
    return (
      <>
        <Suspense fallback={<AppLoader />}>
          <Dashboard user={user} theme={theme} onThemeChange={handleThemeChange} onLogout={handleLogout} onToast={showToast} />
        </Suspense>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </>
    )
  }

  return (
    <div className={`hero app-${theme}`}>
      <Ribbon />

      <div className="hero-content">
        <nav className="navbar">
          <div className="logo">
            <img src="/logo.png" alt="Vyapaar" className="logo-mark" />
            <span className="logo-word">Vyapaar</span>
          </div>
          <div className="nav-actions">
            <button className="btn-ghost" onClick={() => openModal('login')}>
              <UserIcon />
              Log in
            </button>
            <button className="btn-primary" onClick={() => openModal('register')}>
              <UserPlusIcon />
              Register
            </button>
          </div>
        </nav>

        <div className="hero-main">
          <h1 className="wordmark">Vyapaar</h1>
          <img
            src="/hero-building-cutout.png"
            onError={(e) => { e.currentTarget.src = '/hero-building.png' }}
            alt="Architecture"
            className="hero-building"
          />
        </div>

        {/* CTA pill opens register modal */}
        <div className="cta-pill" onClick={() => openModal('register')} role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && openModal('register')}>
          <span>Explore Vyapaar</span>
          <span className="cta-arrow">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        <div className="theme-toggle" role="group" aria-label="Theme">
          <button
            className={theme === 'light' ? 'toggle-btn active' : 'toggle-btn'}
            aria-label="Light theme"
            aria-pressed={theme === 'light'}
            onClick={() => handleThemeChange('light')}
          >
            <SunIcon />
          </button>
          <button
            className={theme === 'dark' ? 'toggle-btn active' : 'toggle-btn'}
            aria-label="Dark theme"
            aria-pressed={theme === 'dark'}
            onClick={() => handleThemeChange('dark')}
          >
            <MoonIcon />
          </button>
        </div>
      </div>

      {modal && (
        <AuthModal
          initialTab={modal}
          onClose={closeModal}
          onSuccess={handleAuthSuccess}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  )
}
