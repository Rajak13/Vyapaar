/**
 * Settings & Fiscal Periods API Routes
 */

import { Router } from 'express'
import { pool } from './auth.js'
import { requireAuth } from '../middleware.js'
import { ensureFiscalPeriods } from './purchase-entries.js'

const router = Router()
router.use(requireAuth)

// GET /api/settings/business-profile
router.get('/settings/business-profile', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM business_profile WHERE user_id = $1 LIMIT 1`,
      [req.user.id]
    )
    return res.json({ profile: rows[0] ?? null })
  } catch (err) {
    console.error('[GET /api/settings/business-profile]', err)
    return res.status(500).json({ error: 'Failed to load business profile.' })
  }
})

// PUT /api/settings/business-profile
router.put('/settings/business-profile', async (req, res) => {
  const { taxpayer_name, taxpayer_registration_no, pan, address } = req.body ?? {}
  if (!taxpayer_name?.trim()) {
    return res.status(400).json({ error: 'Taxpayer name is required.' })
  }
  try {
    const existing = await pool.query(
      `SELECT id FROM business_profile WHERE user_id = $1 LIMIT 1`,
      [req.user.id]
    )
    let row
    if (existing.rowCount > 0) {
      const { rows } = await pool.query(
        `UPDATE business_profile
         SET taxpayer_name=$1, taxpayer_registration_no=$2, pan=$3, address=$4
         WHERE id=$5 AND user_id=$6 RETURNING *`,
        [taxpayer_name.trim(), taxpayer_registration_no?.trim()||null,
         pan?.trim()||null, address?.trim()||null,
         existing.rows[0].id, req.user.id]
      )
      row = rows[0]
    } else {
      const { rows } = await pool.query(
        `INSERT INTO business_profile (taxpayer_name, taxpayer_registration_no, pan, address, user_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [taxpayer_name.trim(), taxpayer_registration_no?.trim()||null,
         pan?.trim()||null, address?.trim()||null, req.user.id]
      )
      row = rows[0]
    }
    return res.json({ profile: row })
  } catch (err) {
    console.error('[PUT /api/settings/business-profile]', err)
    return res.status(500).json({ error: 'Failed to save business profile.' })
  }
})

// GET /api/fiscal-periods — list all for this user
router.get('/fiscal-periods', async (req, res) => {
  try {
    await ensureFiscalPeriods(req.user.id)
    const { rows } = await pool.query(
      `SELECT * FROM fiscal_periods WHERE user_id = $1 ORDER BY bs_year DESC, bs_month DESC`,
      [req.user.id]
    )
    return res.json({ periods: rows })
  } catch (err) {
    console.error('[GET /api/fiscal-periods]', err)
    return res.status(500).json({ error: 'Failed to load fiscal periods.' })
  }
})

// POST /api/fiscal-periods — create new period for this user
router.post('/fiscal-periods', async (req, res) => {
  const { fiscal_year_bs, bs_year, bs_month, fiscal_month_index } = req.body ?? {}
  if (!fiscal_year_bs || !bs_year || !bs_month || !fiscal_month_index) {
    return res.status(400).json({ error: 'All fiscal period fields are required.' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO fiscal_periods (fiscal_year_bs, bs_year, bs_month, fiscal_month_index, user_id)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, bs_year, bs_month) DO UPDATE
       SET fiscal_year_bs=EXCLUDED.fiscal_year_bs, fiscal_month_index=EXCLUDED.fiscal_month_index
       RETURNING *`,
      [fiscal_year_bs, parseInt(bs_year,10), parseInt(bs_month,10), parseInt(fiscal_month_index,10), req.user.id]
    )
    return res.status(201).json({ period: rows[0] })
  } catch (err) {
    console.error('[POST /api/fiscal-periods]', err)
    return res.status(500).json({ error: 'Failed to create fiscal period.' })
  }
})

// DELETE /api/settings/account
// Permanently deletes the authenticated user and all their data via CASCADE.
// Requires { confirm_email } matching their account email as a safety check.
router.delete('/settings/account', async (req, res) => {
  const { confirm_email } = req.body ?? {}
  const userId = req.user.id

  if (!confirm_email) {
    return res.status(400).json({ error: 'Please provide your email address to confirm deletion.' })
  }

  try {
    const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [userId])
    if (!rows[0]) return res.status(404).json({ error: 'Account not found.' })

    if (rows[0].email.toLowerCase() !== confirm_email.toLowerCase().trim()) {
      return res.status(400).json({ error: 'Email address does not match your account.' })
    }

    // Delete user — all related data cascades via ON DELETE CASCADE on FK constraints
    await pool.query('DELETE FROM users WHERE id = $1', [userId])

    // Clear auth cookie
    const { getCookieOptions } = await import('./auth.js')
    const { maxAge, ...clearOptions } = getCookieOptions()
    res.clearCookie('vyapaaar_token', clearOptions)

    return res.json({ message: 'Account permanently deleted.' })
  } catch (err) {
    console.error('[DELETE /api/settings/account]', err)
    return res.status(500).json({ error: 'Failed to delete account. Please try again.' })
  }
})

export default router
