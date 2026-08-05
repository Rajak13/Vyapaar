import jwt from 'jsonwebtoken'

/**
 * requireAuth — Express middleware that verifies the httpOnly JWT cookie.
 */
export function requireAuth(req, res, next) {
  let token = req.cookies?.vyapaaar_token || req.headers.authorization?.replace(/^Bearer\s+/i, '')

  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: 'Not authenticated.' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (!payload?.sub) {
      return res.status(401).json({ error: 'Invalid session payload.' })
    }
    req.user = { id: payload.sub, email: payload.email, full_name: payload.full_name }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' })
  }
}
