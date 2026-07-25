# Vyapaaar Auth Module

Self-contained Express + PostgreSQL authentication. Copy the entire `auth/` folder into your main app repo.

---

## What's included

| File | Purpose |
|---|---|
| `auth/schema.sql` | `users` table — run once against your Postgres DB |
| `server/routes.js` | Express router: register, login, logout, /me |
| `server/middleware.js` | `requireAuth` middleware — protects any route |
| `server/index.js` | Express entry point — mounts the router |

---

## Setup

### 1. Install dependencies in your main app

```bash
npm install express bcrypt jsonwebtoken pg cookie-parser
```

### 2. Environment variables

Create a `.env` file (never commit it):

```env
DATABASE_URL=postgres://user:password@host:5432/vyapaaar
JWT_SECRET=replace-with-a-long-random-string-min-32-chars
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

Generate a secure `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Run the schema

```bash
psql $DATABASE_URL -f auth/schema.sql
```

Or paste the contents of `schema.sql` into your Neon/Supabase SQL editor.

### 4. Mount the router in your Express app

```js
import express from 'express'
import cookieParser from 'cookie-parser'
import authRouter from './auth/routes.js'

const app = express()

app.use(express.json())
app.use(cookieParser())          // required — reads httpOnly cookies

app.use('/auth', authRouter)     // exposes /auth/register, /auth/login, /auth/logout, /auth/me
```

### 5. Protect routes with the middleware

```js
import { requireAuth } from './auth/middleware.js'

// Any route that needs an authenticated user:
app.get('/api/purchase-entries', requireAuth, async (req, res) => {
  // req.user = { id, email, full_name }
})
```

---

## API reference

### `POST /auth/register`
```json
// Request body
{ "email": "user@example.com", "password": "min8chars", "full_name": "Ram Bahadur" }

// 200 response — sets httpOnly cookie, returns user
{ "user": { "id": 1, "email": "user@example.com", "full_name": "Ram Bahadur" } }

// Error responses
// 400 — missing fields or password too short
// 409 — email already registered
// 500 — server error
```

### `POST /auth/login`
```json
// Request body
{ "email": "user@example.com", "password": "yourpassword" }

// 200 — sets httpOnly cookie, returns user
// 401 — invalid email or password
```

### `POST /auth/logout`
```json
// No body needed.
// 200 — clears the cookie
{ "message": "Logged out." }
```

### `GET /auth/me`
```json
// No body — reads the cookie automatically.
// 200 — returns current user
{ "user": { "id": 1, "email": "...", "full_name": "..." } }
// 401 — not authenticated or session expired
```

---

## CORS (if frontend is on a different origin)

```js
import cors from 'cors'

app.use(cors({
  origin: process.env.FRONTEND_URL,  // e.g. http://localhost:5173
  credentials: true,                  // required for cookies to work cross-origin
}))
```

And in your frontend `fetch` calls, always include `credentials: 'include'` — the `AuthModal.jsx` component already does this.

---

## Security notes

- Passwords are hashed with **bcrypt** (12 rounds). Never stored in plaintext.
- JWT is stored in an **httpOnly cookie** — inaccessible to JavaScript, resistant to XSS.
- Login uses **constant-time comparison** even for non-existent users to prevent email enumeration.
- Set `NODE_ENV=production` in production — this enables the `Secure` flag on the cookie (HTTPS only).
- Use a strong, unique `JWT_SECRET` — minimum 32 random bytes.
