/**
 * Purchase Entries + Suppliers API
 * Mounted at /api in server/index.js
 * All routes protected with requireAuth middleware.
 */

import { Router } from 'express'
import { pool } from './routes.js'
import { requireAuth } from './middleware.js'

const router = Router()

// Apply auth to every route in this file
router.use(requireAuth)

// ── Helpers ────────────────────────────────────────────────────────────────

function parseNumeric(val) {
  if (val === undefined || val === null || val === '') return 0
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPPLIERS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/suppliers — list all active suppliers for autocomplete
router.get('/suppliers', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, pan, phone, address
       FROM suppliers
       WHERE is_active = true
       ORDER BY name ASC`
    )
    return res.json({ suppliers: rows })
  } catch (err) {
    console.error('[GET /api/suppliers]', err)
    return res.status(500).json({ error: 'Failed to load suppliers.' })
  }
})

// POST /api/suppliers — create a new supplier inline
router.post('/suppliers', async (req, res) => {
  const { name, pan, phone, address } = req.body ?? {}

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Supplier name is required.' })
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO suppliers (name, pan, phone, address)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, pan, phone, address`,
      [name.trim(), pan?.trim() || null, phone?.trim() || null, address?.trim() || null]
    )
    return res.status(201).json({ supplier: rows[0] })
  } catch (err) {
    console.error('[POST /api/suppliers]', err)
    return res.status(500).json({ error: 'Failed to create supplier.' })
  }
})

// PUT /api/suppliers/:id — update supplier details
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
       WHERE id = $6
       RETURNING id, name, pan, phone, address, is_active`,
      [name.trim(), pan?.trim() || null, phone?.trim() || null, address?.trim() || null,
       is_active !== undefined ? is_active : true, id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Supplier not found.' })
    return res.json({ supplier: rows[0] })
  } catch (err) {
    console.error('[PUT /api/suppliers/:id]', err)
    return res.status(500).json({ error: 'Failed to update supplier.' })
  }
})

// GET /api/suppliers/balances — all supplier balances from the view
router.get('/suppliers/balances', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         sb.supplier_id,
         sb.supplier_name,
         sb.supplier_pan,
         sb.total_purchased,
         sb.total_paid,
         sb.balance_due,
         s.phone,
         s.address,
         s.is_active,
         s.created_at
       FROM supplier_balances sb
       JOIN suppliers s ON s.id = sb.supplier_id
       ORDER BY sb.supplier_name ASC`
    )
    return res.json({ suppliers: rows })
  } catch (err) {
    console.error('[GET /api/suppliers/balances]', err)
    return res.status(500).json({ error: 'Failed to load supplier balances.' })
  }
})

// GET /api/purchase-entries/stats — summary numbers for the dashboard
// MUST be defined before GET /purchase-entries to avoid being shadowed
router.get('/purchase-entries/stats', async (req, res) => {
  try {
    const [totalsRow, suppliersRow, currentMonthRow] = await Promise.all([
      // Total purchases this fiscal year (all time for now — update when fiscal_periods is populated)
      pool.query(`SELECT COALESCE(SUM(grand_total), 0) AS total_fy,
                         COALESCE(SUM(grand_total) FILTER (WHERE date_ad >= date_trunc('month', now())), 0) AS total_month
                  FROM purchase_entries`),
      // Active supplier count
      pool.query(`SELECT COUNT(*) FROM suppliers WHERE is_active = true`),
      // Entries this month
      pool.query(`SELECT COUNT(*) FROM purchase_entries
                  WHERE date_ad >= date_trunc('month', now())`),
    ])

    return res.json({
      totalPurchasesFY:    totalsRow.rows[0].total_fy,
      totalPurchasesMonth: totalsRow.rows[0].total_month,
      activeSuppliers:     parseInt(suppliersRow.rows[0].count, 10),
      entriesThisMonth:    parseInt(currentMonthRow.rows[0].count, 10),
    })
  } catch (err) {
    console.error('[GET /api/purchase-entries/stats]', err)
    return res.status(500).json({ error: 'Failed to load stats.' })
  }
})

// GET /api/purchase-entries — paginated list with optional filters
// Query params: limit, offset, supplier_id, fiscal_period_id, search, date_from, date_to
router.get('/purchase-entries', async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  ?? '20', 10), 100)
  const offset = parseInt(req.query.offset ?? '0', 10)
  const { supplier_id, fiscal_period_id, search, date_from, date_to } = req.query

  const conditions = []
  const params     = []
  let   p          = 1

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

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
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
         s.pan  AS supplier_pan
       FROM purchase_entries pe
       JOIN suppliers s ON s.id = pe.supplier_id
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
    date_bs,
    date_ad,
    invoice_no,
    supplier_id,
    supplier_name,
    supplier_pan,
    account_head,
    tax_exempt_purchases,
    taxable_purchases,
    taxable_imports,
    capital_taxable_purchases,
    tax_amount,
    notes,
    fiscal_period_id,
    business_profile_id,
  } = req.body ?? {}

  // ── Required field validation ──────────────────────────────────────────
  if (!date_ad) return res.status(400).json({ error: 'Date (AD) is required.' })
  if (!invoice_no?.trim()) return res.status(400).json({ error: 'Invoice number is required.' })
  if (!supplier_id && !supplier_name?.trim()) {
    return res.status(400).json({ error: 'Supplier is required.' })
  }

  // ── At least one purchase value must be > 0 ────────────────────────────
  const totalValue =
    parseNumeric(tax_exempt_purchases) +
    parseNumeric(taxable_purchases) +
    parseNumeric(taxable_imports) +
    parseNumeric(capital_taxable_purchases)
  if (totalValue <= 0) {
    return res.status(400).json({ error: 'At least one purchase value must be greater than zero.' })
  }

  // ── Numeric validation ─────────────────────────────────────────────────
  const numFields = {
    tax_exempt_purchases,
    taxable_purchases,
    taxable_imports,
    capital_taxable_purchases,
    tax_amount,
  }
  for (const [field, val] of Object.entries(numFields)) {
    const n = parseNumeric(val)
    if (n === null || n < 0) {
      return res.status(400).json({ error: `${field.replace(/_/g, ' ')} must be a non-negative number.` })
    }
  }
  // ──────────────────────────────────────────────────────────────────────

  try {
    // Resolve supplier — use existing ID or create new one inline
    let resolvedSupplierId = supplier_id ? parseInt(supplier_id, 10) : null

    if (!resolvedSupplierId && supplier_name?.trim()) {
      // Check if supplier with this name already exists, create if not
      const existing = await pool.query(
        `SELECT id FROM suppliers WHERE name = $1 LIMIT 1`,
        [supplier_name.trim()]
      )
      if (existing.rowCount > 0) {
        resolvedSupplierId = existing.rows[0].id
      } else {
        const { rows: newSupplier } = await pool.query(
          `INSERT INTO suppliers (name, pan) VALUES ($1, $2) RETURNING id`,
          [supplier_name.trim(), supplier_pan?.trim() || null]
        )
        resolvedSupplierId = newSupplier[0].id
      }
    }

    // Resolve business_profile_id — fall back to first profile if not provided
    let bpId = business_profile_id ? parseInt(business_profile_id, 10) : null
    if (!bpId) {
      const { rows: bp } = await pool.query(`SELECT id FROM business_profile LIMIT 1`)
      bpId = bp[0]?.id ?? null
    }
    if (!bpId) {
      return res.status(400).json({ error: 'No business profile found. Create one first.' })
    }

    // Resolve fiscal_period_id — optional, use provided or look up by date
    let fpId = fiscal_period_id ? parseInt(fiscal_period_id, 10) : null
    if (!fpId) {
      const d = new Date(date_ad)
      const { rows: fp } = await pool.query(
        `SELECT id FROM fiscal_periods
         WHERE bs_year IS NOT NULL
         LIMIT 1`
      )
      fpId = fp[0]?.id ?? null
    }
    if (!fpId) {
      return res.status(400).json({
        error: 'Could not determine fiscal period. Please set up fiscal periods first.',
      })
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
        bpId,
        fpId,
        date_bs ?? '',
        date_ad,
        invoice_no.trim(),
        resolvedSupplierId,
        account_head?.trim() || null,
        parseNumeric(tax_exempt_purchases),
        parseNumeric(taxable_purchases),
        parseNumeric(taxable_imports),
        parseNumeric(capital_taxable_purchases),
        parseNumeric(tax_amount),
        notes?.trim() || null,
        req.user.id,
      ]
    )

    return res.status(201).json({ entry: rows[0] })
  } catch (err) {
    console.error('[POST /api/purchase-entries]', err)
    return res.status(500).json({ error: 'Failed to create purchase entry.' })
  }
})

export default router
