# Vyapaar — Business Accounting App

Vite + React frontend + Express/Postgres backend. Handles purchase entries, suppliers, payments, and fiscal period management for Nepali businesses.

## Run locally

```bash
npm install
npm run dev        # frontend (http://localhost:5173)

cd server
npm install
node index.js      # backend (http://localhost:3001)
```

## Database setup

**One-time setup:**
```bash
# Apply the full schema (single source of truth):
psql $DATABASE_URL -f schema.sql

# If upgrading an existing DB, run migrations in order:
node server/migrate.js    # adds user_id to shared tables
node server/migrate2.js   # renames created_by → user_id, adds supplier unique constraint
```

> **Note:** `schema.sql` at the project root is the canonical schema. `auth/full-schema.sql` is kept for reference but `schema.sql` is the authoritative version.

## Production deployment

- **Frontend:** Vercel — auto-deploys from `main` branch. `vercel.json` rewrites `/api/*` and `/auth/*` to the Render backend, making auth cookies same-origin (no iOS Safari issues).
- **Backend:** Render — `server/index.js` as start command, `NODE_ENV=production`.
- **Database:** Neon Postgres — use `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (for migrations).

## Key files

- `src/App.jsx` — landing page + auth, lazy-loads Dashboard
- `src/api.js` — central API fetcher (cookie-based auth, TanStack Query keys & fetchers)
- `server/routes.js` — auth endpoints (register, login, logout, /me)
- `server/purchase-entries.js` — all business data API endpoints
- `server/middleware.js` — `requireAuth` middleware
- `vercel.json` — same-origin proxy rewrites
- `schema.sql` — canonical database schema
