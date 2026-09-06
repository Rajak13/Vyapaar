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

// GET /api/settings/backup/stats
// Quick summary of data records for logged-in user
router.get('/settings/backup/stats', async (req, res) => {
  const userId = req.user.id
  try {
    const [suppCount, entryCount, payCount, periodCount] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM suppliers WHERE user_id = $1', [userId]),
      pool.query('SELECT COUNT(*)::int AS count FROM purchase_entries WHERE user_id = $1', [userId]),
      pool.query('SELECT COUNT(*)::int AS count FROM supplier_payments WHERE user_id = $1', [userId]),
      pool.query('SELECT COUNT(*)::int AS count FROM fiscal_periods WHERE user_id = $1', [userId]),
    ])

    return res.json({
      stats: {
        suppliers: suppCount.rows[0]?.count ?? 0,
        purchase_entries: entryCount.rows[0]?.count ?? 0,
        payments: payCount.rows[0]?.count ?? 0,
        fiscal_periods: periodCount.rows[0]?.count ?? 0,
        neon_free_tier_status: 'Healthy (0.5 GB quota)'
      }
    })
  } catch (err) {
    console.error('[GET /api/settings/backup/stats]', err)
    return res.status(500).json({ error: 'Failed to compute backup stats.' })
  }
})

// GET /api/settings/backup/download
// Downloads a complete standalone JSON snapshot of all user records
router.get('/settings/backup/download', async (req, res) => {
  const userId = req.user.id
  try {
    const [profileRes, periodsRes, suppliersRes, entriesRes, paymentsRes] = await Promise.all([
      pool.query('SELECT * FROM business_profile WHERE user_id = $1', [userId]),
      pool.query('SELECT * FROM fiscal_periods WHERE user_id = $1 ORDER BY bs_year, bs_month', [userId]),
      pool.query('SELECT * FROM suppliers WHERE user_id = $1 ORDER BY id', [userId]),
      pool.query('SELECT * FROM purchase_entries WHERE user_id = $1 ORDER BY date_ad, id', [userId]),
      pool.query('SELECT * FROM supplier_payments WHERE user_id = $1 ORDER BY date_ad, id', [userId]),
    ])

    const backupPayload = {
      app: 'Vyapaar',
      version: '1.0',
      exported_at: new Date().toISOString(),
      user: {
        id: req.user.id,
        email: req.user.email,
        full_name: req.user.full_name
      },
      counts: {
        business_profile: profileRes.rowCount,
        fiscal_periods: periodsRes.rowCount,
        suppliers: suppliersRes.rowCount,
        purchase_entries: entriesRes.rowCount,
        supplier_payments: paymentsRes.rowCount,
      },
      data: {
        business_profile: profileRes.rows[0] ?? null,
        fiscal_periods: periodsRes.rows,
        suppliers: suppliersRes.rows,
        purchase_entries: entriesRes.rows,
        supplier_payments: paymentsRes.rows
      }
    }

    const filename = `vyapaar-backup-${new Date().toISOString().slice(0, 10)}.json`
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/json')
    return res.send(JSON.stringify(backupPayload, null, 2))
  } catch (err) {
    console.error('[GET /api/settings/backup/download]', err)
    return res.status(500).json({ error: 'Failed to generate database backup.' })
  }
})

// POST /api/settings/backup/restore
// Restores data from a previously downloaded Vyapaar JSON backup
router.post('/settings/backup/restore', async (req, res) => {
  const userId = req.user.id
  const { backup } = req.body ?? {}

  if (!backup || backup.app !== 'Vyapaar' || !backup.data) {
    return res.status(400).json({ error: 'Invalid backup file. Must be an official Vyapaar JSON backup.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { business_profile, fiscal_periods = [], suppliers = [], purchase_entries = [], supplier_payments = [] } = backup.data

    // 1. Restore Business Profile
    let bpId = null
    if (business_profile) {
      const bpCheck = await client.query('SELECT id FROM business_profile WHERE user_id = $1 LIMIT 1', [userId])
      if (bpCheck.rowCount > 0) {
        bpId = bpCheck.rows[0].id
        await client.query(
          `UPDATE business_profile
           SET taxpayer_name=$1, taxpayer_registration_no=$2, pan=$3, address=$4
           WHERE id=$5`,
          [business_profile.taxpayer_name, business_profile.taxpayer_registration_no, business_profile.pan, business_profile.address, bpId]
        )
      } else {
        const bpInsert = await client.query(
          `INSERT INTO business_profile (taxpayer_name, taxpayer_registration_no, pan, address, user_id)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [business_profile.taxpayer_name, business_profile.taxpayer_registration_no, business_profile.pan, business_profile.address, userId]
        )
        bpId = bpInsert.rows[0].id
      }
    } else {
      const defaultBp = await client.query('SELECT id FROM business_profile WHERE user_id = $1 LIMIT 1', [userId])
      if (defaultBp.rowCount > 0) {
        bpId = defaultBp.rows[0].id
      } else {
        const ins = await client.query('INSERT INTO business_profile (taxpayer_name, user_id) VALUES ($1, $2) RETURNING id', ['My Business', userId])
        bpId = ins.rows[0].id
      }
    }

    // 2. Restore Fiscal Periods (map old id -> new id)
    const periodMap = new Map()
    for (const fp of fiscal_periods) {
      const { rows } = await client.query(
        `INSERT INTO fiscal_periods (fiscal_year_bs, bs_year, bs_month, fiscal_month_index, user_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, bs_year, bs_month) DO UPDATE
         SET fiscal_year_bs=EXCLUDED.fiscal_year_bs, fiscal_month_index=EXCLUDED.fiscal_month_index
         RETURNING id`,
        [fp.fiscal_year_bs, fp.bs_year, fp.bs_month, fp.fiscal_month_index, userId]
      )
      periodMap.set(fp.id, rows[0].id)
    }

    // 3. Restore Suppliers (map old id -> new id)
    const supplierMap = new Map()
    for (const s of suppliers) {
      const { rows } = await client.query(
        `INSERT INTO suppliers (name, pan, phone, address, opening_balance, is_active, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, name) DO UPDATE
         SET pan=EXCLUDED.pan, phone=EXCLUDED.phone, address=EXCLUDED.address, opening_balance=EXCLUDED.opening_balance
         RETURNING id`,
        [s.name, s.pan || null, s.phone || null, s.address || null, s.opening_balance || 0, s.is_active !== false, userId]
      )
      supplierMap.set(s.id, rows[0].id)
    }

    // 4. Restore Purchase Entries (map old id -> new id)
    const entryMap = new Map()
    for (const pe of purchase_entries) {
      const mappedSupplierId = supplierMap.get(pe.supplier_id)
      const mappedPeriodId = periodMap.get(pe.fiscal_period_id)
      const mappedClaimedPeriodId = pe.claimed_fiscal_period_id ? (periodMap.get(pe.claimed_fiscal_period_id) || null) : null

      if (!mappedSupplierId || !mappedPeriodId) {
        continue // Skip orphaned entry
      }

      // Check if entry with same invoice_no, supplier, and date exists for this user
      const existingEntry = await client.query(
        `SELECT id FROM purchase_entries
         WHERE user_id = $1 AND supplier_id = $2 AND invoice_no = $3 AND date_ad = $4
         LIMIT 1`,
        [userId, mappedSupplierId, pe.invoice_no, pe.date_ad]
      )

      let newEntryId
      if (existingEntry.rowCount > 0) {
        newEntryId = existingEntry.rows[0].id
        await client.query(
          `UPDATE purchase_entries
           SET date_bs=$1, tax_exempt_purchases=$2, taxable_purchases=$3, taxable_imports=$4,
               capital_taxable_purchases=$5, tax_amount=$6, is_missed_bill=$7, claimed_fiscal_period_id=$8,
               notes=$9, updated_at=now()
           WHERE id=$10`,
          [
            pe.date_bs, pe.tax_exempt_purchases || 0, pe.taxable_purchases || 0,
            pe.taxable_imports || 0, pe.capital_taxable_purchases || 0, pe.tax_amount || 0,
            pe.is_missed_bill || false, mappedClaimedPeriodId, pe.notes || null, newEntryId
          ]
        )
      } else {
        const ins = await client.query(
          `INSERT INTO purchase_entries (
            business_profile_id, fiscal_period_id, date_bs, date_ad, page_no,
            invoice_no, supplier_id, account_head, tax_exempt_purchases, taxable_purchases,
            taxable_imports, capital_taxable_purchases, tax_amount, is_missed_bill,
            claimed_fiscal_period_id, notes, user_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
          RETURNING id`,
          [
            bpId, mappedPeriodId, pe.date_bs, pe.date_ad, pe.page_no || null,
            pe.invoice_no, mappedSupplierId, pe.account_head || null,
            pe.tax_exempt_purchases || 0, pe.taxable_purchases || 0,
            pe.taxable_imports || 0, pe.capital_taxable_purchases || 0,
            pe.tax_amount || 0, pe.is_missed_bill || false,
            mappedClaimedPeriodId, pe.notes || null, userId
          ]
        )
        newEntryId = ins.rows[0].id
      }
      entryMap.set(pe.id, newEntryId)
    }

    // 5. Restore Supplier Payments
    for (const p of supplier_payments) {
      const mappedSupplierId = supplierMap.get(p.supplier_id)
      const mappedEntryId = p.purchase_entry_id ? (entryMap.get(p.purchase_entry_id) || null) : null

      if (!mappedSupplierId) continue

      // Avoid duplicating exact payment
      const existingPay = await client.query(
        `SELECT id FROM supplier_payments
         WHERE user_id = $1 AND supplier_id = $2 AND date_ad = $3 AND amount = $4
         LIMIT 1`,
        [userId, mappedSupplierId, p.date_ad, p.amount]
      )

      if (existingPay.rowCount === 0) {
        await client.query(
          `INSERT INTO supplier_payments (
            supplier_id, purchase_entry_id, date_bs, date_ad, amount, payment_method, reference_no, notes, user_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            mappedSupplierId, mappedEntryId, p.date_bs, p.date_ad, p.amount,
            p.payment_method || null, p.reference_no || null, p.notes || null, userId
          ]
        )
      }
    }

    await client.query('COMMIT')

    return res.json({
      message: 'Backup restored successfully!',
      restored: {
        suppliers: suppliers.length,
        purchase_entries: purchase_entries.length,
        supplier_payments: supplier_payments.length
      }
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[POST /api/settings/backup/restore]', err)
    return res.status(500).json({ error: 'Failed to restore backup: ' + err.message })
  } finally {
    client.release()
  }
})

export default router

