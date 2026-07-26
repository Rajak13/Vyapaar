-- ============================================================
-- Vyapaaar Full Schema — SINGLE SOURCE OF TRUTH
-- Last updated: 2026-07-26
-- Run once against your Postgres database to create all tables.
-- For migrations after initial setup, run: node server/migrate.js
--                                     and: node server/migrate2.js
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Business profile (one per user)
CREATE TABLE IF NOT EXISTS business_profile (
    id                       SERIAL PRIMARY KEY,
    taxpayer_name            TEXT NOT NULL,
    taxpayer_registration_no TEXT,
    pan                      TEXT,
    address                  TEXT,
    user_id                  INT REFERENCES users(id) ON DELETE CASCADE,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Suppliers (scoped to user)
CREATE TABLE IF NOT EXISTS suppliers (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    pan         TEXT,
    phone       TEXT,
    address     TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    user_id     INT REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT suppliers_user_name_unique UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name    ON suppliers (name);
CREATE INDEX IF NOT EXISTS idx_suppliers_pan     ON suppliers (pan);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers (user_id);

-- Fiscal periods (scoped to user)
CREATE TABLE IF NOT EXISTS fiscal_periods (
    id                  SERIAL PRIMARY KEY,
    fiscal_year_bs      TEXT NOT NULL,
    bs_year             INT NOT NULL,
    bs_month            INT NOT NULL,
    fiscal_month_index  INT NOT NULL,
    user_id             INT REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fiscal_periods_user_bs_year_bs_month_key UNIQUE (user_id, bs_year, bs_month)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_periods_fy      ON fiscal_periods (fiscal_year_bs);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_user_id ON fiscal_periods (user_id);

-- Purchase entries (scoped to user via user_id)
CREATE TABLE IF NOT EXISTS purchase_entries (
    id                          SERIAL PRIMARY KEY,
    business_profile_id         INT NOT NULL REFERENCES business_profile(id),
    fiscal_period_id            INT NOT NULL REFERENCES fiscal_periods(id),
    date_bs                     TEXT NOT NULL,
    date_ad                     DATE NOT NULL,
    page_no                     TEXT,
    invoice_no                  TEXT NOT NULL,
    supplier_id                 INT NOT NULL REFERENCES suppliers(id),
    account_head                TEXT,
    tax_exempt_purchases        NUMERIC(14,2) NOT NULL DEFAULT 0,
    taxable_purchases           NUMERIC(14,2) NOT NULL DEFAULT 0,
    taxable_imports             NUMERIC(14,2) NOT NULL DEFAULT 0,
    capital_taxable_purchases   NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_amount                  NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_value                 NUMERIC(14,2) GENERATED ALWAYS AS (
                                    tax_exempt_purchases + taxable_purchases +
                                    taxable_imports + capital_taxable_purchases
                                ) STORED,
    grand_total                 NUMERIC(14,2) GENERATED ALWAYS AS (
                                    tax_exempt_purchases + taxable_purchases +
                                    taxable_imports + capital_taxable_purchases + tax_amount
                                ) STORED,
    notes                       TEXT,
    user_id                     INT REFERENCES users(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_entries_supplier ON purchase_entries (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_entries_fiscal   ON purchase_entries (fiscal_period_id);
CREATE INDEX IF NOT EXISTS idx_purchase_entries_date_ad  ON purchase_entries (date_ad);
CREATE INDEX IF NOT EXISTS idx_purchase_entries_invoice  ON purchase_entries (invoice_no);
CREATE INDEX IF NOT EXISTS idx_purchase_entries_user_id  ON purchase_entries (user_id);

-- Supplier payments (scoped to user via user_id)
CREATE TABLE IF NOT EXISTS supplier_payments (
    id                  SERIAL PRIMARY KEY,
    supplier_id         INT NOT NULL REFERENCES suppliers(id),
    purchase_entry_id   INT REFERENCES purchase_entries(id),
    date_bs             TEXT NOT NULL,
    date_ad             DATE NOT NULL,
    amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    payment_method      TEXT,
    reference_no        TEXT,
    notes               TEXT,
    user_id             INT REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_entry    ON supplier_payments (purchase_entry_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date_ad  ON supplier_payments (date_ad);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_user_id  ON supplier_payments (user_id);

-- View: per-supplier outstanding balance
CREATE OR REPLACE VIEW purchase_entry_due AS
SELECT
    pe.id                                               AS purchase_entry_id,
    pe.supplier_id,
    pe.invoice_no,
    pe.date_ad,
    pe.grand_total,
    COALESCE(paid.paid_amount, 0)                       AS paid_amount,
    pe.grand_total - COALESCE(paid.paid_amount, 0)      AS amount_due
FROM purchase_entries pe
LEFT JOIN (
    SELECT purchase_entry_id, SUM(amount) AS paid_amount
    FROM supplier_payments
    WHERE purchase_entry_id IS NOT NULL
    GROUP BY purchase_entry_id
) paid ON paid.purchase_entry_id = pe.id;
