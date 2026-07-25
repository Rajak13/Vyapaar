import { useState, useEffect } from 'react'
import './App.css'
import AuthModal from './AuthModal'
import Toast from './Toast'
import Dashboard from './Dashboard'

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
        d="M 480 640 C 620 580 680 500 800 420 C 900 360 960 300 1060 210"
        fill="none"
        stroke="var(--orange)"
        strokeWidth="42"
        strokeLinecap="round"
      />
      <text className="ribbon-text" fill="var(--ink)">
        <textPath href="#ribbonPath" startOffset="0%">
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

export default function App() {
  const [theme, setTheme] = useState('dark')
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)
  const [user, setUser] = useState(null)
  const [sessionChecked, setSessionChecked] = useState(false)

  // On every page load, check if a valid session cookie exists.
  // If it does, restore the user and go straight to the dashboard.
  useEffect(() => {
    fetch('/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) setUser(data.user)
      })
      .catch(() => {})
      .finally(() => setSessionChecked(true))
  }, [])

  // Don't render anything until we know whether the user is logged in —
  // prevents a flash of the landing page before redirecting to dashboard.
  if (!sessionChecked) return null

  function openModal(tab) { setModal(tab) }
  function closeModal()   { setModal(null) }

  function showToast(message, type = 'success') {
    setToast({ message, type })
  }

  // Called by AuthModal on success — receives the user object from the API response
  function handleAuthSuccess(msg, loggedInUser) {
    setUser(loggedInUser)
    showToast(msg, 'success')
  }

  function handleLogout() {
    fetch('/auth/logout', { method: 'POST', credentials: 'include' })
    sessionStorage.removeItem('vyapaar_nav')
    setUser(null)
    showToast('You have been logged out.', 'success')
  }

  // If authenticated, show the dashboard instead of the landing page
  if (user) {
    return (
      <>
        <Dashboard user={user} theme={theme} onThemeChange={setTheme} onLogout={handleLogout} onToast={showToast} />
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
            src="/hero-building.png"
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
            onClick={() => setTheme('light')}
          >
            <SunIcon />
          </button>
          <button
            className={theme === 'dark' ? 'toggle-btn active' : 'toggle-btn'}
            aria-label="Dark theme"
            aria-pressed={theme === 'dark'}
            onClick={() => setTheme('dark')}
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
