import { useState, useEffect, lazy, Suspense } from 'react'
import './App.css'
import AuthModal from './AuthModal'
import Toast from './Toast'
import { queryClient } from './queryClient'
import Terms from './Terms'
import Privacy from './Privacy'
import LandingPage from './LandingPage'

// Code-split the post-login app — a logged-out visitor on the landing page
// shouldn't download any of this code.
const Dashboard = lazy(() => import('./Dashboard'))

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

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

  // Auto-open auth modal if URL has #login or #register
  useEffect(() => {
    if (hash === '#login') {
      setModal('login')
    } else if (hash === '#register') {
      setModal('register')
    }
  }, [hash])

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
    <>
      <LandingPage
        theme={theme}
        onThemeChange={handleThemeChange}
        onOpenAuth={openModal}
      />

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
    </>
  )
}
