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

import authRouter from './routes/auth.js'
import healthRouter from './routes/health.js'
import suppliersRouter from './routes/suppliers.js'
import purchaseEntriesRouter from './routes/purchase-entries.js'
import paymentsRouter from './routes/payments.js'
import settingsRouter from './routes/settings.js'
import dashboardRouter from './routes/dashboard.js'

const app = express()
const PORT = process.env.PORT ?? 3001

// ── Security headers (helmet first, before everything else) ────────────────
app.use(helmet())

// ── Health check endpoint for cron-job.org keep-alive (unrestricted) ───────
app.use(healthRouter)

// ── Core middleware ────────────────────────────────────────────────────────
app.use(express.json())
app.use(cookieParser())

// Build allowed origins list from FRONTEND_URL (comma-separated for multi-env support)
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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

app.use('/api', healthRouter)
app.use('/api', suppliersRouter)
app.use('/api', purchaseEntriesRouter)
app.use('/api', paymentsRouter)
app.use('/api', settingsRouter)
app.use('/api', dashboardRouter)

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Vyapaaar API running on http://localhost:${PORT}`)

  // Auto-ensure database view on startup.
  // We DROP + CREATE instead of CREATE OR REPLACE because PostgreSQL doesn't
  // allow renaming or reordering existing view columns via REPLACE.
  import('./routes/auth.js').then(({ pool }) => {
    pool.query(`
      DROP VIEW IF EXISTS purchase_entry_due;
      CREATE VIEW purchase_entry_due AS
      SELECT
          pe.id                                               AS purchase_entry_id,
          pe.supplier_id,
          pe.invoice_no,
          pe.date_ad,
          pe.grand_total,
          COALESCE(paid.paid_amount, 0)                       AS paid_amount,
          pe.grand_total - COALESCE(paid.paid_amount, 0)      AS amount_due
      FROM purchase_entries pe
      LEFT JOIN (
          SELECT purchase_entry_id, SUM(amount) AS paid_amount
          FROM supplier_payments
          WHERE purchase_entry_id IS NOT NULL
          GROUP BY purchase_entry_id
      ) paid ON paid.purchase_entry_id = pe.id;
    `).then(() => {
      console.log('[DB] View purchase_entry_due ensured OK.')
    }).catch(err => console.error('[DB View Init Error]', err.message))
  }).catch(() => {})
})
