import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { config } from 'dotenv'

// Load .env from project root regardless of where the process is started from
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })

import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import authRouter from './routes.js'
import purchaseEntriesRouter from './purchase-entries.js'

const app = express()
const PORT = process.env.PORT ?? 3001

// ── Security headers (helmet first, before everything else) ────────────────
app.use(helmet())

// ── Core middleware ────────────────────────────────────────────────────────
app.use(express.json())
app.use(cookieParser())

// Build allowed origins list from FRONTEND_URL (comma-separated for multi-env support)
// Always strip trailing slashes — a misconfigured env var shouldn't break auth.
const rawOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map(o => o.trim().replace(/\/$/, ''))
  .filter(Boolean)

console.log('[CORS] Allowed origins:', rawOrigins)

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server / curl requests with no Origin header
    if (!origin) return callback(null, true)
    if (rawOrigins.includes(origin)) return callback(null, true)
    console.warn('[CORS] Blocked origin:', origin)
    callback(new Error(`Origin ${origin} not allowed by CORS`))
  },
  credentials: true,
}))


// ── Rate limiters (scoped to auth routes only) ─────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' }),
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' }),
})

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/auth/login',    loginLimiter)
app.use('/auth/register', registerLimiter)
app.use('/auth',          authRouter)
app.use('/api',           purchaseEntriesRouter)

app.get('/health', (_req, res) => res.json({ ok: true }))

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Vyapaaar API running on http://localhost:${PORT}`)
})
