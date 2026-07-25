-- ============================================================
-- Vyapaaar Auth Schema — users table only
-- Run this in your Postgres database before starting the server.
-- The full application schema (purchase_entries, suppliers, etc.)
-- lives in schema.sql at the root of your main app repo.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
