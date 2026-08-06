/**
 * Dashboard Charts API
 * Returns all chart data for the overview page in a single request.
 */

import { Router } from 'express'
import { pool } from './auth.js'
import { requireAuth } from '../middleware.js'

const router = Router()
router.use(requireAuth)

router.get('/dashboard/charts', async (req, res) => {
  const userId = req.user.id

  try {
    const [monthlyRes, accountHeadRes, paymentMethodRes, topSuppliersRes, paidStatusRes] =
      await Promise.all([

        // 1. Monthly purchase + tax trend — last 8 months
        pool.query(
          `SELECT
             TO_CHAR(DATE_TRUNC('month', date_ad), 'YYYY-MM') AS month,
             TO_CHAR(DATE_TRUNC('month', date_ad), 'Mon')      AS month_label,
             COUNT(*)::int                                      AS entries,
             COALESCE(SUM(grand_total), 0)::float               AS total_purchased,
             COALESCE(SUM(tax_amount),  0)::float               AS total_tax
           FROM purchase_entries
           WHERE user_id = $1
             AND date_ad >= DATE_TRUNC('month', NOW()) - INTERVAL '7 months'
           GROUP BY 1, 2
           ORDER BY 1 ASC`,
          [userId]
        ),

        // 2. Spend by account_head (category breakdown) — current FY only
        pool.query(
          `SELECT
             COALESCE(account_head, 'Uncategorised') AS category,
             COUNT(*)::int                            AS entries,
             COALESCE(SUM(grand_total), 0)::float     AS total
           FROM purchase_entries
           WHERE user_id = $1
           GROUP BY 1
           ORDER BY total DESC
           LIMIT 7`,
          [userId]
        ),

        // 3. Payment method split
        pool.query(
          `SELECT
             COALESCE(payment_method, 'unknown') AS method,
             COUNT(*)::int                        AS count,
             COALESCE(SUM(amount), 0)::float      AS total
           FROM supplier_payments
           WHERE user_id = $1
           GROUP BY 1
           ORDER BY total DESC`,
          [userId]
        ),

        // 4. Top 5 suppliers by total spend
        pool.query(
          `SELECT
             s.name                                   AS supplier_name,
             COUNT(pe.id)::int                        AS entries,
             COALESCE(SUM(pe.grand_total), 0)::float  AS total_purchased,
             COALESCE(SUM(sp.amount),      0)::float  AS total_paid
           FROM suppliers s
           JOIN purchase_entries pe ON pe.supplier_id = s.id AND pe.user_id = $1
           LEFT JOIN (
             SELECT supplier_id, SUM(amount) AS amount
             FROM supplier_payments WHERE user_id = $1
             GROUP BY supplier_id
           ) sp ON sp.supplier_id = s.id
           WHERE s.user_id = $1
           GROUP BY s.id, s.name
           ORDER BY total_purchased DESC
           LIMIT 5`,
          [userId]
        ),

        // 5. Entry paid-status breakdown (paid / partial / pending)
        pool.query(
          `SELECT
             CASE
               WHEN grand_total - COALESCE(paid.paid_amount, 0) <= 0 THEN 'paid'
               WHEN COALESCE(paid.paid_amount, 0) > 0               THEN 'partial'
               ELSE 'pending'
             END AS status,
             COUNT(*)::int AS count
           FROM purchase_entries pe
           LEFT JOIN (
             SELECT purchase_entry_id, SUM(amount) AS paid_amount
             FROM supplier_payments WHERE user_id = $1 AND purchase_entry_id IS NOT NULL
             GROUP BY purchase_entry_id
           ) paid ON paid.purchase_entry_id = pe.id
           WHERE pe.user_id = $1
           GROUP BY 1`,
          [userId]
        ),
      ])

    return res.json({
      monthly:       monthlyRes.rows,
      accountHeads:  accountHeadRes.rows,
      paymentMethods: paymentMethodRes.rows,
      topSuppliers:  topSuppliersRes.rows,
      paidStatus:    paidStatusRes.rows,
    })
  } catch (err) {
    console.error('[GET /api/dashboard/charts]', err)
    return res.status(500).json({ error: 'Failed to load chart data.' })
  }
})

export default router
