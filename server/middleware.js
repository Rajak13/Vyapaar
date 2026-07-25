import jwt from 'jsonwebtoken'

/**
 * requireAuth — Express middleware that verifies the httpOnly JWT cookie.
 *
 * On success:  attaches `req.user = { id, email, full_name }` and calls next().
 * On failure:  responds 401 JSON { error: '...' }.
 *
 * Usage:
 *   import { requireAuth } from './auth/middleware.js'
 *   router.get('/protected', requireAuth, handler)
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.vyapaaar_token

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated.' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = { id: payload.sub, email: payload.email, full_name: payload.full_name }
    next()
  } catch (err) {
    // Expired or tampered token
    return res.status(401).json({ error: 'Session expired. Please log in again.' })
  }
}
