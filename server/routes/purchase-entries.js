/**
 * Purchase Entries API Routes
 */

import { Router } from 'express'
import { pool } from './auth.js'
import { requireAuth } from '../middleware.js'
import nepaliDatePkg from 'nepali-date-converter'

const NepaliDate = nepaliDatePkg.default || nepaliDatePkg

function getBsDate(date = new Date()) {
  try {
    const d = new NepaliDate(date)
    return { year: d.getYear(), month: d.getMonth() + 1, day: d.getDate() }
  } catch {
    const d = new NepaliDate(new Date())
    return { year: d.getYear(), month: d.getMonth() + 1, day: d.getDate() }
  }
}

function parseNumeric(val) {
  if (val === undefined || val === null || val === '') return 0
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

// Memory cache to avoid repeated DB checks for fiscal period existence
const userSeededSet = new Set()

export async function ensureFiscalPeriods(userId) {
  if (userSeededSet.has(userId)) return

  const { rows } = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM fiscal_periods WHERE user_id = $1) AS has_periods`,
    [userId]
  )
  if (rows[0]?.has_periods) {
    userSeededSet.add(userId)
    return
  }

  const bsNow = getBsDate()
  const currentFyStartYear = bsNow.month >= 4 ? bsNow.year : bsNow.year - 1

  const inserts = []
  for (let fyOffset = 0; fyOffset <= 1; fyOffset++) {
    const startYear = currentFyStartYear + fyOffset
    const endYear   = startYear + 1
    const label     = `${startYear}/${String(endYear).slice(-3)}`
    for (let m = 4; m <= 12; m++) {
      inserts.push([label, startYear, m, m - 3, userId])
    }
    for (let m = 1; m <= 3; m++) {
      inserts.push([label, endYear, m, m + 9, userId])
    }
  }

  await Promise.all(
    inserts.map(([label, bsYear, bsMonth, idx, uid]) =>
      pool.query(
        `INSERT INTO fiscal_periods (fiscal_year_bs, bs_year, bs_month, fiscal_month_index, user_id)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id, bs_year, bs_month) DO NOTHING`,
        [label, bsYear, bsMonth, idx, uid]
      )
    )
  )

  userSeededSet.add(userId)
}

const router = Router()
router.use(requireAuth)

// GET /api/purchase-entries/stats — dashboard summary for this user
router.get('/purchase-entries/stats', async (req, res) => {
  try {
    await ensureFiscalPeriods(req.user.id)
    const userId = req.user.id

    const bsDate = getBsDate(new Date())
    const bsYear  = bsDate.year
    const bsMonth = bsDate.month

    const defaultFyLabel = `${bsMonth >= 4 ? bsYear : bsYear - 1}/${String((bsMonth >= 4 ? bsYear : bsYear - 1) + 1).slice(-3)}`

    // Run primary stats queries in parallel
    const [todayFpRes, totalsRes, suppliersRes, currentMonthRes] = await Promise.all([
      pool.query(
        `SELECT fiscal_year_bs, fiscal_month_index
         FROM fiscal_periods
         WHERE bs_year = $1 AND bs_month = $2 AND user_id = $3
         LIMIT 1`,
        [bsYear, bsMonth, userId]
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(pe.grand_total), 0)  AS total_fy,
           COALESCE(SUM(pe.grand_total) FILTER (WHERE pe.date_ad >= date_trunc('month', now())), 0) AS total_month,
           COALESCE(SUM(pe.tax_amount),  0)  AS tax_total
         FROM purchase_entries pe
         LEFT JOIN fiscal_periods fp ON fp.id = pe.fiscal_period_id
         WHERE pe.user_id = $1 AND (fp.fiscal_year_bs = $2 OR pe.fiscal_period_id IS NULL)`,
        [userId, defaultFyLabel]
      ),
      pool.query(
        `SELECT COUNT(*) FROM suppliers WHERE is_active = true AND user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM purchase_entries
         WHERE date_ad >= date_trunc('month', now()) AND user_id = $1`,
        [userId]
      ),
    ])

    const fiscalYearBs     = todayFpRes.rows[0]?.fiscal_year_bs || defaultFyLabel
    const fiscalMonthIndex = todayFpRes.rows[0]?.fiscal_month_index || 1

    const { rows: fps } = await pool.query(
      `SELECT fp.fiscal_year_bs, fp.bs_year, fp.bs_month, fp.fiscal_month_index,
              COUNT(pe.id) AS entry_count
       FROM fiscal_periods fp
       LEFT JOIN purchase_entries pe
              ON pe.fiscal_period_id = fp.id AND pe.user_id = $2
       WHERE fp.fiscal_year_bs = $1 AND fp.user_id = $2
       GROUP BY fp.id, fp.fiscal_year_bs, fp.bs_year, fp.bs_month, fp.fiscal_month_index
       ORDER BY fp.fiscal_month_index`,
      [fiscalYearBs, userId]
    )

    const BS_MONTHS = ['','Baisakh','Jestha','Ashad','Shrawan','Bhadra','Ashwin',
                       'Kartik','Mangsir','Poush','Magh','Falgun','Chaitra']

    const fiscalRange = fps.length > 0
      ? `${BS_MONTHS[fps[0].bs_month]} — ${BS_MONTHS[fps[fps.length - 1].bs_month]}`
      : 'Shrawan — Ashad'
    const fiscalProgress = fiscalMonthIndex !== null
      ? Math.round((fiscalMonthIndex / 12) * 100)
      : 0

    return res.json({
      totalPurchasesFY:    Number(totalsRes.rows[0].total_fy),
      totalPurchasesMonth: Number(totalsRes.rows[0].total_month),
      taxTotal:            Number(totalsRes.rows[0].tax_total),
      activeSuppliers:     Number(suppliersRes.rows[0].count),
      entriesThisMonth:    Number(currentMonthRes.rows[0].count),
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
  const { supplier_id, fiscal_period_id, search, date_from, date_to, sort_by } = req.query

  let orderBy = 'ORDER BY pe.date_ad DESC, pe.id DESC'
  if (sort_by === 'date_asc')       orderBy = 'ORDER BY pe.date_ad ASC, pe.id ASC'
  else if (sort_by === 'amount_desc')   orderBy = 'ORDER BY pe.grand_total DESC, pe.id DESC'
  else if (sort_by === 'amount_asc')    orderBy = 'ORDER BY pe.grand_total ASC, pe.id ASC'
  else if (sort_by === 'supplier_asc')  orderBy = 'ORDER BY s.name ASC, pe.id DESC'
  else if (sort_by === 'supplier_desc') orderBy = 'ORDER BY s.name DESC, pe.id DESC'
  else if (sort_by === 'due_desc')      orderBy = 'ORDER BY (pe.grand_total - COALESCE(ped.paid_amount, 0)) DESC, pe.id DESC'

  const conditions = ['pe.user_id = $1']
  const params     = [req.user.id]
  let p            = 2

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
         (pe.grand_total - COALESCE(ped.paid_amount, 0)) AS amount_due,
         CASE
           WHEN (pe.grand_total - COALESCE(ped.paid_amount, 0)) <= 0 THEN 'paid'
           WHEN COALESCE(ped.paid_amount, 0) > 0                     THEN 'partial'
           ELSE 'pending'
         END AS paid_status
       FROM purchase_entries pe
       JOIN suppliers s ON s.id = pe.supplier_id
       LEFT JOIN (
         SELECT purchase_entry_id, SUM(amount) AS paid_amount
         FROM supplier_payments
         WHERE purchase_entry_id IS NOT NULL
         GROUP BY purchase_entry_id
       ) ped ON ped.purchase_entry_id = pe.id
       ${where}
       ${orderBy}
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

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    let resolvedSupplierId = supplier_id ? parseInt(supplier_id, 10) : null

    if (!resolvedSupplierId && supplier_name?.trim()) {
      const { rows: newSupplier } = await client.query(
        `INSERT INTO suppliers (name, pan, user_id) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [supplier_name.trim(), supplier_pan?.trim() || null, req.user.id]
      )
      resolvedSupplierId = newSupplier[0].id
    }

    let bpId = business_profile_id ? parseInt(business_profile_id, 10) : null
    if (!bpId) {
      const { rows: bp } = await client.query(
        `SELECT id FROM business_profile WHERE user_id = $1 LIMIT 1`,
        [req.user.id]
      )
      bpId = bp[0]?.id ?? null
    }
    if (!bpId) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'No business profile found. Create one first in Settings.' })
    }

    let fpId = fiscal_period_id ? parseInt(fiscal_period_id, 10) : null
    if (!fpId && date_bs) {
      const bsParts = String(date_bs).split('-')
      const bsYear  = parseInt(bsParts[0], 10)
      const bsMonth = parseInt(bsParts[1], 10)
      if (!isNaN(bsYear) && !isNaN(bsMonth)) {
        const { rows: fp } = await client.query(
          `SELECT id FROM fiscal_periods WHERE bs_year = $1 AND bs_month = $2 AND user_id = $3 LIMIT 1`,
          [bsYear, bsMonth, req.user.id]
        )
        fpId = fp[0]?.id ?? null
        if (!fpId) {
          await ensureFiscalPeriods(req.user.id)
          const { rows: fp2 } = await client.query(
            `SELECT id FROM fiscal_periods WHERE bs_year = $1 AND bs_month = $2 AND user_id = $3 LIMIT 1`,
            [bsYear, bsMonth, req.user.id]
          )
          fpId = fp2[0]?.id ?? null
        }
        if (!fpId) {
          await client.query('ROLLBACK')
          return res.status(400).json({
            error: `No fiscal period found for BS ${bsYear}/${String(bsMonth).padStart(2,'0')}. Please add it in Settings → Fiscal Periods.`,
          })
        }
      }
    }
    if (!fpId) {
      const { rows: fp } = await client.query(
        `SELECT id FROM fiscal_periods WHERE user_id = $1 LIMIT 1`,
        [req.user.id]
      )
      fpId = fp[0]?.id ?? null
    }
    if (!fpId) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Could not determine fiscal period. Please set up fiscal periods in Settings first.' })
    }

    const { rows } = await client.query(
      `INSERT INTO purchase_entries (
         business_profile_id, fiscal_period_id, date_bs, date_ad,
         invoice_no, supplier_id, account_head,
         tax_exempt_purchases, taxable_purchases, taxable_imports,
         capital_taxable_purchases, tax_amount, notes, user_id
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

    await client.query('COMMIT')
    return res.status(201).json({ entry: rows[0] })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[POST /api/purchase-entries]', err)
    return res.status(500).json({ error: 'Failed to create purchase entry.' })
  } finally {
    client.release()
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
       WHERE id = $13 AND user_id = $14
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

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE supplier_payments SET purchase_entry_id = NULL WHERE purchase_entry_id = $1`,
      [id]
    )
    const { rows } = await client.query(
      `DELETE FROM purchase_entries WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, req.user.id]
    )
    if (rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Purchase entry not found.' })
    }
    await client.query('COMMIT')
    return res.json({ message: 'Purchase entry deleted.' })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[DELETE /api/purchase-entries/:id]', err)
    return res.status(500).json({ error: 'Failed to delete purchase entry.' })
  } finally {
    client.release()
  }
})

export default router
