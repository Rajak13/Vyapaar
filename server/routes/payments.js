/**
 * Supplier Payments API Routes
 */

import { Router } from 'express'
import { pool } from './auth.js'
import { requireAuth } from '../middleware.js'

const VALID_METHODS = ['cash', 'online', 'cheque']

const router = Router()
router.use(requireAuth)

// GET /api/supplier-payments — list payments for this user
router.get('/supplier-payments', async (req, res) => {
  const { supplier_id } = req.query
  const limit  = Math.min(parseInt(req.query.limit  ?? '50', 10), 200)
  const offset = parseInt(req.query.offset ?? '0', 10)

  const conditions = ['sp.user_id = $1']
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
          amount, payment_method, reference_no, notes, user_id)
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
      `DELETE FROM supplier_payments WHERE id = $1 AND user_id = $2 RETURNING id`,
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
       FROM supplier_payments WHERE user_id = $1`,
      [req.user.id]
    )
    return res.json(rows[0])
  } catch (err) {
    console.error('[GET /api/supplier-payments/stats]', err)
    return res.status(500).json({ error: 'Failed to load payment stats.' })
  }
})

export default router
