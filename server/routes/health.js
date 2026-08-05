import { Router } from 'express'
import { pool } from './auth.js'

const router = Router()

/**
 * GET /health and GET /api/health
 * Ultra-fast health check endpoint designed for cron-job.org / monitoring services.
 * Keeps Render free tier awake and maintains an active Postgres database pool connection.
 */
async function handleHealthCheck(_req, res) {
  try {
    // Perform lightweight DB query to keep connection pool active
    await pool.query('SELECT 1')
    return res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: 'connected',
    })
  } catch (err) {
    console.error('[health-check] DB ping failed:', err.message)
    return res.status(200).json({
      status: 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    })
  }
}

router.get('/health', handleHealthCheck)

export default router
