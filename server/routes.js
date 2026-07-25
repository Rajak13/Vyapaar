/**
 * Vyapaaar Auth Routes
 * ---------------------
 * Mount in your Express app:
 *
 *   import authRouter from './auth/routes.js'
 *   app.use('/auth', authRouter)
 *
 * Required packages (add to your main app):
 *   npm install express bcrypt jsonwebtoken pg cookie-parser
 *
 * Required env vars (see auth/README.md):
 *   DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, NODE_ENV
 *
 * Cookie strategy: httpOnly JWT stored as 'vyapaaar_token'.
 * No tokens in localStorage — XSS-safe by default.
 */

import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { config } from 'dotenv'
import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import pkg from 'pg'

// Load .env from project root — must run before Pool is instantiated
const __dir = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dir, '../.env') })

const { Pool } = pkg
const router = Router()

// DB pool — created after dotenv has populated process.env
export const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ---------- Helpers ----------
const BCRYPT_ROUNDS = 12

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, full_name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' }
  )
}

function setCookieAndRespond(res, req, user) {
  const token = signToken(user)

  // Determine if the request is secure (HTTPS) to set Secure flag correctly.
  // Trust the `x-forwarded-proto` header if behind a proxy.
  const proto = (req.headers['x-forwarded-proto'] || req.protocol).toLowerCase()
  const isSecure = proto === 'https'

  res.cookie('vyapaaar_token', token, {
    httpOnly: true,
    secure:   isSecure,
    // When secure, we must use SameSite=None to allow cross-site requests.
    // When not secure (e.g., localhost HTTP), use SameSite=Lax for better compatibility.
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  })

  return res.json({
    user: { id: user.id, email: user.email, full_name: user.full_name },
  })
}

// ---------- POST /auth/register ----------
router.post('/register', async (req, res) => {
  const { email, password, full_name } = req.body ?? {}

  // ── Input validation ──────────────────────────────────────────────────────
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Email, password, and full name are required.' })
  }

  // Standard email format check
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address.' })
  }

  // Name: trim, reject empty, cap at 100 chars
  const trimmedName = typeof full_name === 'string' ? full_name.trim().slice(0, 100) : ''
  if (!trimmedName) {
    return res.status(400).json({ error: 'Full name cannot be empty.' })
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()])
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' })
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name`,
      [email.toLowerCase().trim(), password_hash, trimmedName]
    )

    return setCookieAndRespond(res, req, rows[0])
  } catch (err) {
    console.error('[auth/register]', err)
    return res.status(500).json({ error: 'Registration failed. Please try again.' })
  }
})

// ---------- POST /auth/login ----------
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' })
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, email, full_name, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    )

    // Use constant-time comparison even on "not found" to prevent user enumeration
    const user = rows[0]
    const dummyHash = '$2b$12$invalidhashpadding000000000000000000000000000000000000'
    const match = await bcrypt.compare(password, user?.password_hash ?? dummyHash)

    if (!user || !match) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    return setCookieAndRespond(res, req, user)
  } catch (err) {
    console.error('[auth/login]', err)
    return res.status(500).json({ error: 'Login failed. Please try again.' })
  }
})

// ---------- POST /auth/logout ----------
router.post('/logout', (_req, res) => {
  res.clearCookie('vyapaaar_token', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  })
  return res.json({ message: 'Logged out.' })
})

// ---------- GET /auth/me ----------
// Returns the currently authenticated user, or 401.
// Used by the frontend to check session on page load.
router.get('/me', async (req, res) => {
  const token = req.cookies?.vyapaaar_token
  if (!token) return res.status(401).json({ error: 'Not authenticated.' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const { rows } = await pool.query(
      'SELECT id, email, full_name FROM users WHERE id = $1',
      [payload.sub]
    )
    if (!rows[0]) return res.status(401).json({ error: 'User not found.' })
    return res.json({ user: rows[0] })
  } catch {
    return res.status(401).json({ error: 'Session expired.' })
  }
})

export default router
