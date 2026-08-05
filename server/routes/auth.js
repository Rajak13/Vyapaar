/**
 * Vyapaaar Auth Routes
 */

import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { config } from 'dotenv'
import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import pkg from 'pg'

const __dir = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dir, '../../.env') })

const { Pool } = pkg
const router = Router()

export const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const BCRYPT_ROUNDS = 12

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, full_name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' }
  )
}

export function getCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure:   isProd,            // must be true for SameSite=none to work
    sameSite: isProd ? 'none' : 'lax',  // 'none' allows cross-origin (Vercel → Render)
    maxAge:   7 * 24 * 60 * 60 * 1000,
  }
}

function setCookieAndRespond(res, req, user) {
  const token = signToken(user)
  res.cookie('vyapaaar_token', token, getCookieOptions())

  return res.json({
    user: { id: user.id, email: user.email, full_name: user.full_name },
  })
}

// ---------- POST /auth/register ----------
router.post('/register', async (req, res) => {
  const { email, password, full_name } = req.body ?? {}

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Email, password, and full name are required.' })
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address.' })
  }

  const trimmedName = typeof full_name === 'string' ? full_name.trim().slice(0, 100) : ''
  if (!trimmedName) {
    return res.status(400).json({ error: 'Full name cannot be empty.' })
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  }

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
  const { maxAge, ...clearOptions } = getCookieOptions()
  res.clearCookie('vyapaaar_token', clearOptions)
  return res.json({ message: 'Logged out.' })
})

// ---------- GET /auth/me ----------
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
