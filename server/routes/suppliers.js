/**
 * Suppliers API Routes
 */

import { Router } from 'express'
import { pool } from './auth.js'
import { requireAuth } from '../middleware.js'

const router = Router()
router.use(requireAuth)

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
         WHERE user_id = $1
         GROUP BY supplier_id
       ) pe ON pe.supplier_id = s.id
       LEFT JOIN (
         SELECT supplier_id, SUM(amount) AS total_paid
         FROM supplier_payments
         WHERE user_id = $1
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
           WHERE sp.supplier_id = $1 AND sp.user_id = $2
         ), 0)                                                   AS total_paid,
         COALESCE(SUM(pe.grand_total), 0) - COALESCE((
           SELECT SUM(sp.amount) FROM supplier_payments sp
           WHERE sp.supplier_id = $1 AND sp.user_id = $2
         ), 0)                                                   AS balance_due
       FROM purchase_entries pe
       WHERE pe.supplier_id = $1 AND pe.user_id = $2`,
      [id, req.user.id]
    )
    return res.json(rows[0] ?? { total_purchased: 0, total_paid: 0, balance_due: 0 })
  } catch (err) {
    console.error('[GET /api/suppliers/:id/balance]', err)
    return res.status(500).json({ error: 'Failed to load supplier balance.' })
  }
})

export default router
