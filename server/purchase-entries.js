/**
 * Purchase Entries + Suppliers API
 * Mounted at /api in server/index.js
 * All routes protected with requireAuth middleware.
 * Every query is scoped by req.user.id for full multi-tenant isolation.
 */

import { Router } from 'express'
import { pool } from './routes.js'
import { requireAuth } from './middleware.js'
// import { ad2bs } from 'nepali-date-converter'

const router = Router()

// Apply auth to every route in this file
router.use(requireAuth)

// ── Helpers ────────────────────────────────────────────────────────────────

function parseNumeric(val) {
  if (val === undefined || val === null || val === '') return 0
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

/**
 * Auto-seed fiscal periods for a user if they have none.
 * Seeds both 2082/083 and 2083/084 (Nepal fiscal year starts Shrawan = month 4).
 *   Fiscal year X/Y:  months 4–12 of BS year X, then months 1–3 of BS year Y
 *   fiscal_month_index: 1=Shrawan … 9=Chaitra, 10=Baisakh, 11=Jestha, 12=Ashad
 */
async function ensureFiscalPeriods(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) FROM fiscal_periods WHERE user_id = $1`,
    [userId]
  )
  if (parseInt(rows[0].count, 10) > 0) return // already seeded

  const fiscalYears = [
    { label: '2082/083', startBsYear: 2082 },
    { label: '2083/084', startBsYear: 2083 },
  ]

  for (const fy of fiscalYears) {
    const { startBsYear } = fy
    // Months 4–12 of startBsYear  (index 1–9)
    for (let m = 4; m <= 12; m++) {
      await pool.query(
        `INSERT INTO fiscal_periods (fiscal_year_bs, bs_year, bs_month, fiscal_month_index, user_id)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id, bs_year, bs_month) DO NOTHING`,
        [fy.label, startBsYear, m, m - 3, userId]
      )
    }
    // Months 1–3 of startBsYear+1  (index 10–12)
    for (let m = 1; m <= 3; m++) {
      await pool.query(
        `INSERT INTO fiscal_periods (fiscal_year_bs, bs_year, bs_month, fiscal_month_index, user_id)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id, bs_year, bs_month) DO NOTHING`,
        [fy.label, startBsYear + 1, m, m + 9, userId]
      )
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIERS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/suppliers — list all active suppliers for this user
router.get('/suppliers', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, pan, phone, address
       FROM suppliers
       WHERE is_active = true AND user_id = $1
       ORDER BY name ASC`,
      [req.user.id]
    )
    return res.json({ suppliers: rows })
  } catch (err) {
    console.error('[GET /api/suppliers]', err)
    return res.status(500).json({ error: 'Failed to load suppliers.' })
  }
})

// POST /api/suppliers — create a new supplier for this user
router.post('/suppliers', async (req, res) => {
  const { name, pan, phone, address } = req.body ?? {}

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Supplier name is required.' })
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO suppliers (name, pan, phone, address, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, pan, phone, address`,
      [name.trim(), pan?.trim() || null, phone?.trim() || null, address?.trim() || null, req.user.id]
    )
    return res.status(201).json({ supplier: rows[0] })
  } catch (err) {
    console.error('[POST /api/suppliers]', err)
    return res.status(500).json({ error: 'Failed to create supplier.' })
  }
})

// PUT /api/suppliers/:id — update supplier (scoped to user)
router.put('/suppliers/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const { name, pan, phone, address, is_active } = req.body ?? {}

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Supplier name is required.' })
  }

  try {
    const { rows } = await pool.query(
      `UPDATE suppliers
       SET name = $1, pan = $2, phone = $3, address = $4, is_active = $5
       WHERE id = $6 AND user_id = $7
       RETURNING id, name, pan, phone, address, is_active`,
      [name.trim(), pan?.trim() || null, phone?.trim() || null, address?.trim() || null,
       is_active !== undefined ? is_active : true, id, req.user.id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Supplier not found.' })
    return res.json({ supplier: rows[0] })
  } catch (err) {
    console.error('[PUT /api/suppliers/:id]', err)
    return res.status(500).json({ error: 'Failed to update supplier.' })
  }
})

// DELETE /api/suppliers/:id — soft delete (scoped to user)
router.delete('/suppliers/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)

  try {
    const { rows } = await pool.query(
      `UPDATE suppliers
       SET is_active = false
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, req.user.id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Supplier not found.' })
    return res.json({ message: 'Supplier deactivated.' })
  } catch (err) {
    console.error('[DELETE /api/suppliers/:id]', err)
    return res.status(500).json({ error: 'Failed to deactivate supplier.' })
  }
})

// GET /api/suppliers/balances — all supplier balances for this user
router.get('/suppliers/balances', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         s.id                                                AS supplier_id,
         s.name                                              AS supplier_name,
         s.pan                                               AS supplier_pan,
         s.phone,
         s.address,
         s.is_active,
         s.created_at,
         COALESCE(pe.total_purchased, 0)                     AS total_purchased,
         COALESCE(sp.total_paid, 0)                          AS total_paid,
         COALESCE(pe.total_purchased, 0)
           - COALESCE(sp.total_paid, 0)                      AS balance_due
       FROM suppliers s
       LEFT JOIN (
         SELECT supplier_id, SUM(grand_total) AS total_purchased
         FROM purchase_entries
         WHERE created_by = $1
         GROUP BY supplier_id
       ) pe ON pe.supplier_id = s.id
       LEFT JOIN (
         SELECT supplier_id, SUM(amount) AS total_paid
         FROM supplier_payments
         WHERE created_by = $1
         GROUP BY supplier_id
       ) sp ON sp.supplier_id = s.id
       WHERE s.user_id = $1
       ORDER BY s.name ASC`,
      [req.user.id]
    )
    return res.json({ suppliers: rows })
  } catch (err) {
    console.error('[GET /api/suppliers/balances]', err)
    return res.status(500).json({ error: 'Failed to load supplier balances.' })
  }
})

// GET /api/suppliers/:id/balance — single supplier balance for this user
router.get('/suppliers/:id/balance', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid supplier id.' })
  try {
    const { rows } = await pool.query(
      `SELECT
         COALESCE(SUM(pe.grand_total), 0)                       AS total_purchased,
         COALESCE((
           SELECT SUM(sp.amount) FROM supplier_payments sp
           WHERE sp.supplier_id = $1 AND sp.created_by = $2
         ), 0)                                                   AS total_paid,
         COALESCE(SUM(pe.grand_total), 0) - COALESCE((
           SELECT SUM(sp.amount) FROM supplier_payments sp
           WHERE sp.supplier_id = $1 AND sp.created_by = $2
         ), 0)                                                   AS balance_due
       FROM purchase_entries pe
       WHERE pe.supplier_id = $1 AND pe.created_by = $2`,
      [id, req.user.id]
    )
    return res.json(rows[0] ?? { total_purchased: 0, total_paid: 0, balance_due: 0 })
  } catch (err) {
    console.error('[GET /api/suppliers/:id/balance]', err)
    return res.status(500).json({ error: 'Failed to load supplier balance.' })
  }
})

// ════════════════════════════════════════════════════════════════════════════════
// PURCHASE ENTRIES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/purchase-entries/stats — dashboard summary for this user
// MUST be defined before GET /purchase-entries to avoid route shadowing
router.get('/purchase-entries/stats', async (req, res) => {
  try {
    // Auto-seed fiscal periods if user has none
    await ensureFiscalPeriods(req.user.id)

    const userId = req.user.id

    // Three independent stats in parallel
    const [totalsRow, suppliersRow, currentMonthRow] = await Promise.all([
      pool.query(
        `SELECT
           COALESCE(SUM(grand_total), 0)  AS total_fy,
           COALESCE(SUM(grand_total) FILTER (WHERE date_ad >= date_trunc('month', now())), 0) AS total_month,
           COALESCE(SUM(tax_amount),  0)  AS tax_total
         FROM purchase_entries WHERE created_by = $1`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM suppliers WHERE is_active = true AND user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM purchase_entries
         WHERE date_ad >= date_trunc('month', now()) AND created_by = $1`,
        [userId]
      ),
    ])

    // Convert today's AD date to BS
    const today = new Date()
    const bsDate = ad2bs(today)
    const bsYear  = bsDate.year
    const bsMonth = bsDate.month

    // Find the fiscal period matching today's BS year/month for this user
    const { rows: todayFpRows } = await pool.query(
      `SELECT fp.fiscal_year_bs, fp.bs_year, fp.bs_month, fp.fiscal_month_index
       FROM fiscal_periods fp
       WHERE fp.bs_year = $1 AND fp.bs_month = $2 AND fp.user_id = $3`,
      [bsYear, bsMonth, userId]
    )

    let fiscalYearBs       = null
    let fiscalMonthIndex   = null
    let fiscalRows         = []

    if (todayFpRows.length > 0) {
      fiscalYearBs       = todayFpRows[0].fiscal_year_bs
      fiscalMonthIndex   = todayFpRows[0].fiscal_month_index

      const { rows: fps } = await pool.query(
        `SELECT fp.fiscal_year_bs, fp.bs_year, fp.bs_month, fp.fiscal_month_index,
                COUNT(pe.id) AS entry_count
         FROM fiscal_periods fp
         LEFT JOIN purchase_entries pe
                ON pe.fiscal_period_id = fp.id AND pe.created_by = $2
         WHERE fp.fiscal_year_bs = $1 AND fp.user_id = $2
         GROUP BY fp.id, fp.fiscal_year_bs, fp.bs_year, fp.bs_month, fp.fiscal_month_index
         ORDER BY fp.fiscal_month_index`,
        [fiscalYearBs, userId]
      )
      fiscalRows = fps
    }

    const BS_MONTHS = ['','Baisakh','Jestha','Ashad','Shrawan','Bhadra','Ashwin',
                       'Kartik','Mangsir','Poush','Magh','Falgun','Chaitra']

    const fiscalRange = fiscalRows.length > 0
      ? `${BS_MONTHS[fiscalRows[0].bs_month]} — ${BS_MONTHS[fiscalRows[fiscalRows.length - 1].bs_month]}`
      : null
    const fiscalProgress = fiscalMonthIndex !== null
      ? Math.round((fiscalMonthIndex / 12) * 100)
      : 0

    return res.json({
      totalPurchasesFY:    Number(totalsRow.rows[0].total_fy),
      totalPurchasesMonth: Number(totalsRow.rows[0].total_month),
      taxTotal:            Number(totalsRow.rows[0].tax_total),
      activeSuppliers:     Number(suppliersRow.rows[0].count),
      entriesThisMonth:    Number(currentMonthRow.rows[0].count),
      fiscal: fiscalYearBs ? {
        label:    fiscalYearBs,
        range:    fiscalRange,
        progress: fiscalProgress,
      } : null,
    })
  } catch (err) {
    console.error('[GET /api/purchase-entries/stats]', err)
    return res.status(500).json({ error: 'Failed to load stats.' })
  }
})

// GET /api/purchase-entries — paginated list with optional filters (user-scoped)
router.get('/purchase-entries', async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  ?? '20', 10), 100)
  const offset = parseInt(req.query.offset ?? '0', 10)
  const { supplier_id, fiscal_period_id, search, date_from, date_to } = req.query

  // Always scope to this user
  const conditions = ['pe.created_by = $1']
  const params     = [req.user.id]
  let   p          = 2

  if (supplier_id) {
    conditions.push(`pe.supplier_id = $${p++}`)
    params.push(parseInt(supplier_id, 10))
  }
  if (fiscal_period_id) {
    conditions.push(`pe.fiscal_period_id = $${p++}`)
    params.push(parseInt(fiscal_period_id, 10))
  }
  if (search?.trim()) {
    conditions.push(`(pe.invoice_no ILIKE $${p} OR s.name ILIKE $${p})`)
    params.push(`%${search.trim()}%`)
    p++
  }
  if (date_from) {
    conditions.push(`pe.date_ad >= $${p++}`)
    params.push(date_from)
  }
  if (date_to) {
    conditions.push(`pe.date_ad <= $${p++}`)
    params.push(date_to)
  }

  const where = `WHERE ${conditions.join(' AND ')}`
  params.push(limit, offset)

  try {
    const { rows } = await pool.query(
      `SELECT
         pe.id,
         pe.date_bs,
         pe.date_ad,
         pe.invoice_no,
         pe.account_head,
         pe.tax_exempt_purchases,
         pe.taxable_purchases,
         pe.taxable_imports,
         pe.capital_taxable_purchases,
         pe.tax_amount,
         pe.total_value,
         pe.grand_total,
         pe.notes,
         pe.created_at,
         s.id   AS supplier_id,
         s.name AS supplier_name,
         s.pan  AS supplier_pan,
         COALESCE(ped.paid_amount, 0)  AS paid_amount,
         COALESCE(ped.amount_due,  0)  AS amount_due,
         CASE
           WHEN COALESCE(ped.amount_due, pe.grand_total) <= 0             THEN 'paid'
           WHEN COALESCE(ped.paid_amount, 0) > 0                          THEN 'partial'
           ELSE 'pending'
         END AS paid_status
       FROM purchase_entries pe
       JOIN suppliers s ON s.id = pe.supplier_id
       LEFT JOIN purchase_entry_due ped ON ped.purchase_entry_id = pe.id
       ${where}
       ORDER BY pe.date_ad DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      params
    )

    const countParams = params.slice(0, -2)
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM purchase_entries pe
       JOIN suppliers s ON s.id = pe.supplier_id
       ${where}`,
      countParams
    )

    return res.json({
      entries: rows,
      total:   parseInt(countRows[0].count, 10),
      limit,
      offset,
    })
  } catch (err) {
    console.error('[GET /api/purchase-entries]', err)
    return res.status(500).json({ error: 'Failed to load purchase entries.' })
  }
})

// POST /api/purchase-entries — create a new entry
router.post('/purchase-entries', async (req, res) => {
  const {
    date_bs, date_ad, invoice_no, supplier_id, supplier_name, supplier_pan,
    account_head, tax_exempt_purchases, taxable_purchases, taxable_imports,
    capital_taxable_purchases, tax_amount, notes, fiscal_period_id, business_profile_id,
  } = req.body ?? {}

  if (!date_ad)             return res.status(400).json({ error: 'Date (AD) is required.' })
  if (!invoice_no?.trim())  return res.status(400).json({ error: 'Invoice number is required.' })
  if (!supplier_id && !supplier_name?.trim()) {
    return res.status(400).json({ error: 'Supplier is required.' })
  }

  const totalValue =
    parseNumeric(tax_exempt_purchases) +
    parseNumeric(taxable_purchases) +
    parseNumeric(taxable_imports) +
    parseNumeric(capital_taxable_purchases)
  if (totalValue <= 0) {
    return res.status(400).json({ error: 'At least one purchase value must be greater than zero.' })
  }

  const numFields = { tax_exempt_purchases, taxable_purchases, taxable_imports, capital_taxable_purchases, tax_amount }
  for (const [field, val] of Object.entries(numFields)) {
    const n = parseNumeric(val)
    if (n === null || n < 0) {
      return res.status(400).json({ error: `${field.replace(/_/g, ' ')} must be a non-negative number.` })
    }
  }

  try {
    // Resolve supplier — scoped to this user
    let resolvedSupplierId = supplier_id ? parseInt(supplier_id, 10) : null

    if (!resolvedSupplierId && supplier_name?.trim()) {
      const existing = await pool.query(
        `SELECT id FROM suppliers WHERE name = $1 AND user_id = $2 LIMIT 1`,
        [supplier_name.trim(), req.user.id]
      )
      if (existing.rowCount > 0) {
        resolvedSupplierId = existing.rows[0].id
      } else {
        const { rows: newSupplier } = await pool.query(
          `INSERT INTO suppliers (name, pan, user_id) VALUES ($1, $2, $3) RETURNING id`,
          [supplier_name.trim(), supplier_pan?.trim() || null, req.user.id]
        )
        resolvedSupplierId = newSupplier[0].id
      }
    }

    // Resolve business_profile_id — scoped to user
    let bpId = business_profile_id ? parseInt(business_profile_id, 10) : null
    if (!bpId) {
      const { rows: bp } = await pool.query(
        `SELECT id FROM business_profile WHERE user_id = $1 LIMIT 1`,
        [req.user.id]
      )
      bpId = bp[0]?.id ?? null
    }
    if (!bpId) {
      return res.status(400).json({ error: 'No business profile found. Create one first in Settings.' })
    }

    // Resolve fiscal_period_id — scoped to user
    let fpId = fiscal_period_id ? parseInt(fiscal_period_id, 10) : null
    if (!fpId && date_bs) {
      const bsParts = String(date_bs).split('-')
      const bsYear  = parseInt(bsParts[0], 10)
      const bsMonth = parseInt(bsParts[1], 10)
      if (!isNaN(bsYear) && !isNaN(bsMonth)) {
        const { rows: fp } = await pool.query(
          `SELECT id FROM fiscal_periods WHERE bs_year = $1 AND bs_month = $2 AND user_id = $3 LIMIT 1`,
          [bsYear, bsMonth, req.user.id]
        )
        fpId = fp[0]?.id ?? null
        if (!fpId) {
          // Auto-seed and retry
          await ensureFiscalPeriods(req.user.id)
          const { rows: fp2 } = await pool.query(
            `SELECT id FROM fiscal_periods WHERE bs_year = $1 AND bs_month = $2 AND user_id = $3 LIMIT 1`,
            [bsYear, bsMonth, req.user.id]
          )
          fpId = fp2[0]?.id ?? null
        }
        if (!fpId) {
          return res.status(400).json({
            error: `No fiscal period found for BS ${bsYear}/${String(bsMonth).padStart(2,'0')}. Please add it in Settings → Fiscal Periods.`,
          })
        }
      }
    }
    if (!fpId) {
      const { rows: fp } = await pool.query(
        `SELECT id FROM fiscal_periods WHERE user_id = $1 LIMIT 1`,
        [req.user.id]
      )
      fpId = fp[0]?.id ?? null
    }
    if (!fpId) {
      return res.status(400).json({ error: 'Could not determine fiscal period. Please set up fiscal periods in Settings first.' })
    }

    const { rows } = await pool.query(
      `INSERT INTO purchase_entries (
         business_profile_id, fiscal_period_id, date_bs, date_ad,
         invoice_no, supplier_id, account_head,
         tax_exempt_purchases, taxable_purchases, taxable_imports,
         capital_taxable_purchases, tax_amount, notes, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        bpId, fpId, date_bs ?? '', date_ad, invoice_no.trim(),
        resolvedSupplierId, account_head?.trim() || null,
        parseNumeric(tax_exempt_purchases), parseNumeric(taxable_purchases),
        parseNumeric(taxable_imports), parseNumeric(capital_taxable_purchases),
        parseNumeric(tax_amount), notes?.trim() || null, req.user.id,
      ]
    )

    return res.status(201).json({ entry: rows[0] })
  } catch (err) {
    console.error('[POST /api/purchase-entries]', err)
    return res.status(500).json({ error: 'Failed to create purchase entry.' })
  }
})

// PUT /api/purchase-entries/:id — update an existing entry (scoped to user)
router.put('/purchase-entries/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid entry id.' })

  const {
    date_bs, date_ad, invoice_no, supplier_id,
    account_head, tax_exempt_purchases, taxable_purchases, taxable_imports,
    capital_taxable_purchases, tax_amount, notes, fiscal_period_id,
  } = req.body ?? {}

  if (!date_ad)            return res.status(400).json({ error: 'Date (AD) is required.' })
  if (!invoice_no?.trim()) return res.status(400).json({ error: 'Invoice number is required.' })

  const totalValue =
    parseNumeric(tax_exempt_purchases) +
    parseNumeric(taxable_purchases) +
    parseNumeric(taxable_imports) +
    parseNumeric(capital_taxable_purchases)
  if (totalValue <= 0) {
    return res.status(400).json({ error: 'At least one purchase value must be greater than zero.' })
  }

  try {
    // Resolve fiscal_period_id if not provided
    let fpId = fiscal_period_id ? parseInt(fiscal_period_id, 10) : null
    if (!fpId && date_bs) {
      const bsParts = String(date_bs).split('-')
      const bsYear  = parseInt(bsParts[0], 10)
      const bsMonth = parseInt(bsParts[1], 10)
      if (!isNaN(bsYear) && !isNaN(bsMonth)) {
        const { rows: fp } = await pool.query(
          `SELECT id FROM fiscal_periods WHERE bs_year = $1 AND bs_month = $2 AND user_id = $3 LIMIT 1`,
          [bsYear, bsMonth, req.user.id]
        )
        fpId = fp[0]?.id ?? null
      }
    }

    const { rows } = await pool.query(
      `UPDATE purchase_entries SET
         date_bs = $1, date_ad = $2, invoice_no = $3, supplier_id = $4,
         account_head = $5, tax_exempt_purchases = $6, taxable_purchases = $7,
         taxable_imports = $8, capital_taxable_purchases = $9, tax_amount = $10,
         notes = $11, fiscal_period_id = COALESCE($12, fiscal_period_id)
       WHERE id = $13 AND created_by = $14
       RETURNING *`,
      [
        date_bs ?? '', date_ad, invoice_no.trim(),
        supplier_id ? parseInt(supplier_id, 10) : null,
        account_head?.trim() || null,
        parseNumeric(tax_exempt_purchases), parseNumeric(taxable_purchases),
        parseNumeric(taxable_imports), parseNumeric(capital_taxable_purchases),
        parseNumeric(tax_amount), notes?.trim() || null,
        fpId, id, req.user.id,
      ]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Purchase entry not found.' })
    return res.json({ entry: rows[0] })
  } catch (err) {
    console.error('[PUT /api/purchase-entries/:id]', err)
    return res.status(500).json({ error: 'Failed to update purchase entry.' })
  }
})

// DELETE /api/purchase-entries/:id — hard delete (scoped to user)
router.delete('/purchase-entries/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)

  try {
    await pool.query(
      `UPDATE supplier_payments SET purchase_entry_id = NULL WHERE purchase_entry_id = $1`,
      [id]
    )
    const { rows } = await pool.query(
      `DELETE FROM purchase_entries WHERE id = $1 AND created_by = $2 RETURNING id`,
      [id, req.user.id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Purchase entry not found.' })
    return res.json({ message: 'Purchase entry deleted.' })
  } catch (err) {
    console.error('[DELETE /api/purchase-entries/:id]', err)
    return res.status(500).json({ error: 'Failed to delete purchase entry.' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// SUPPLIER PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════

const VALID_METHODS = ['cash', 'online', 'cheque']

// GET /api/supplier-payments — list payments for this user
router.get('/supplier-payments', async (req, res) => {
  const { supplier_id } = req.query
  const limit  = Math.min(parseInt(req.query.limit  ?? '50', 10), 200)
  const offset = parseInt(req.query.offset ?? '0', 10)

  const conditions = ['sp.created_by = $1']
  const params     = [req.user.id]
  let p = 2

  if (supplier_id) {
    conditions.push(`sp.supplier_id = $${p++}`)
    params.push(parseInt(supplier_id, 10))
  }

  const where = `WHERE ${conditions.join(' AND ')}`
  params.push(limit, offset)

  try {
    const { rows } = await pool.query(
      `SELECT
         sp.id, sp.supplier_id, sp.purchase_entry_id,
         sp.date_bs, sp.date_ad, sp.amount,
         sp.payment_method, sp.reference_no, sp.notes, sp.created_at,
         s.name  AS supplier_name,
         pe.invoice_no
       FROM supplier_payments sp
       JOIN suppliers s ON s.id = sp.supplier_id
       LEFT JOIN purchase_entries pe ON pe.id = sp.purchase_entry_id
       ${where}
       ORDER BY sp.date_ad DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      params
    )
    const countParams = params.slice(0, -2)
    const { rows: cr } = await pool.query(
      `SELECT COUNT(*) FROM supplier_payments sp ${where}`,
      countParams
    )
    return res.json({ payments: rows, total: parseInt(cr[0].count, 10) })
  } catch (err) {
    console.error('[GET /api/supplier-payments]', err)
    return res.status(500).json({ error: 'Failed to load payments.' })
  }
})

// POST /api/supplier-payments — record a payment
router.post('/supplier-payments', async (req, res) => {
  const {
    supplier_id, purchase_entry_id,
    date_bs, date_ad, amount,
    payment_method, reference_no, notes,
  } = req.body ?? {}

  if (!supplier_id)    return res.status(400).json({ error: 'Supplier is required.' })
  if (!date_ad)        return res.status(400).json({ error: 'Date (AD) is required.' })
  if (!date_bs)        return res.status(400).json({ error: 'Date (BS) is required.' })
  const amt = parseFloat(amount)
  if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Amount must be greater than zero.' })
  if (!payment_method || !VALID_METHODS.includes(payment_method)) {
    return res.status(400).json({ error: 'Payment method must be cash, online, or cheque.' })
  }
  if (payment_method === 'cheque' && !reference_no?.trim()) {
    return res.status(400).json({ error: 'Cheque number is required for cheque payments.' })
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO supplier_payments
         (supplier_id, purchase_entry_id, date_bs, date_ad,
          amount, payment_method, reference_no, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        parseInt(supplier_id, 10),
        purchase_entry_id ? parseInt(purchase_entry_id, 10) : null,
        date_bs, date_ad, amt, payment_method,
        reference_no?.trim() || null, notes?.trim() || null,
        req.user.id,
      ]
    )
    return res.status(201).json({ payment: rows[0] })
  } catch (err) {
    console.error('[POST /api/supplier-payments]', err)
    return res.status(500).json({ error: 'Failed to record payment.' })
  }
})

// DELETE /api/supplier-payments/:id — hard delete (scoped to user)
router.delete('/supplier-payments/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid payment id.' })
  try {
    const { rows } = await pool.query(
      `DELETE FROM supplier_payments WHERE id = $1 AND created_by = $2 RETURNING id`,
      [id, req.user.id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Payment not found.' })
    return res.json({ message: 'Payment deleted.' })
  } catch (err) {
    console.error('[DELETE /api/supplier-payments/:id]', err)
    return res.status(500).json({ error: 'Failed to delete payment.' })
  }
})

// GET /api/supplier-payments/stats — totals for this user
router.get('/supplier-payments/stats', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COALESCE(SUM(amount), 0)                                        AS total_paid,
         COALESCE(SUM(amount) FILTER (WHERE payment_method = 'cash'),    0) AS paid_cash,
         COALESCE(SUM(amount) FILTER (WHERE payment_method = 'online'),  0) AS paid_online,
         COALESCE(SUM(amount) FILTER (WHERE payment_method = 'cheque'),  0) AS paid_cheque
       FROM supplier_payments WHERE created_by = $1`,
      [req.user.id]
    )
    return res.json(rows[0])
  } catch (err) {
    console.error('[GET /api/supplier-payments/stats]', err)
    return res.status(500).json({ error: 'Failed to load payment stats.' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS — business profile + fiscal periods (user-scoped)
// ═══════════════════════════════════════════════════════════════════════════

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

export default router