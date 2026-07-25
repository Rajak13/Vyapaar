-- =============================================================================
-- Vyapaaar — Full Database Schema
-- Run this once against a fresh Neon database
-- =============================================================================

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Business Profile ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_profile (
    id                        SERIAL PRIMARY KEY,
    taxpayer_name             TEXT NOT NULL,
    taxpayer_registration_no  TEXT,
    pan                       TEXT,
    address                   TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Suppliers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
    id         SERIAL PRIMARY KEY,
    name       TEXT NOT NULL,
    pan        TEXT,
    phone      TEXT,
    address    TEXT,
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Fiscal Periods ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fiscal_periods (
    id                 SERIAL PRIMARY KEY,
    fiscal_year_bs     TEXT NOT NULL,
    bs_year            INT  NOT NULL,
    bs_month           INT  NOT NULL,
    fiscal_month_index INT  NOT NULL,
    UNIQUE (bs_year, bs_month)
);

-- ── Purchase Entries ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_entries (
    id                        SERIAL PRIMARY KEY,
    business_profile_id       INT NOT NULL REFERENCES business_profile(id),
    fiscal_period_id          INT NOT NULL REFERENCES fiscal_periods(id),
    date_bs                   TEXT NOT NULL,
    date_ad                   DATE NOT NULL,
    page_no                   TEXT,
    invoice_no                TEXT NOT NULL,
    supplier_id               INT NOT NULL REFERENCES suppliers(id),
    account_head              TEXT,
    tax_exempt_purchases      NUMERIC(14,2) NOT NULL DEFAULT 0,
    taxable_purchases         NUMERIC(14,2) NOT NULL DEFAULT 0,
    taxable_imports           NUMERIC(14,2) NOT NULL DEFAULT 0,
    capital_taxable_purchases NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_amount                NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_value               NUMERIC(14,2) GENERATED ALWAYS AS (
                                  tax_exempt_purchases + taxable_purchases +
                                  taxable_imports + capital_taxable_purchases
                              ) STORED,
    grand_total               NUMERIC(14,2) GENERATED ALWAYS AS (
                                  tax_exempt_purchases + taxable_purchases +
                                  taxable_imports + capital_taxable_purchases + tax_amount
                              ) STORED,
    notes                     TEXT,
    created_by                INT REFERENCES users(id),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Supplier Payments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_payments (
    id                SERIAL PRIMARY KEY,
    supplier_id       INT NOT NULL REFERENCES suppliers(id),
    purchase_entry_id INT REFERENCES purchase_entries(id),
    date_bs           TEXT NOT NULL,
    date_ad           DATE NOT NULL,
    amount            NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    payment_method    TEXT,
    reference_no      TEXT,
    notes             TEXT,
    created_by        INT REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- supplier_balances: per-supplier total purchased, total paid, balance due
CREATE OR REPLACE VIEW supplier_balances AS
SELECT
    s.id   AS supplier_id,
    s.name AS supplier_name,
    s.pan  AS supplier_pan,
    COALESCE((SELECT SUM(pe2.grand_total) FROM purchase_entries pe2 WHERE pe2.supplier_id = s.id), 0) AS total_purchased,
    COALESCE((SELECT SUM(sp2.amount)      FROM supplier_payments sp2 WHERE sp2.supplier_id = s.id), 0) AS total_paid,
    COALESCE((SELECT SUM(pe2.grand_total) FROM purchase_entries pe2 WHERE pe2.supplier_id = s.id), 0) -
    COALESCE((SELECT SUM(sp2.amount)      FROM supplier_payments sp2 WHERE sp2.supplier_id = s.id), 0) AS balance_due
FROM suppliers s;

-- purchase_entry_due: per-invoice paid amount and outstanding amount
CREATE OR REPLACE VIEW purchase_entry_due AS
SELECT
    pe.id           AS purchase_entry_id,
    pe.grand_total,
    COALESCE(SUM(sp.amount), 0)                   AS paid_amount,
    pe.grand_total - COALESCE(SUM(sp.amount), 0)  AS amount_due
FROM purchase_entries pe
LEFT JOIN supplier_payments sp ON sp.purchase_entry_id = pe.id
GROUP BY pe.id, pe.grand_total;

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- Business profile (required: purchase_entries FK references this)
INSERT INTO business_profile (taxpayer_name, taxpayer_registration_no, pan, address)
SELECT 'My Business', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM business_profile);

-- Fiscal periods for BS year 2081/082
-- fiscal_month_index: 1=Shrawan, 2=Bhadra, 3=Ashwin, 4=Kartik, 5=Mangsir,
--   6=Poush, 7=Magh, 8=Falgun, 9=Chaitra, 10=Baisakh, 11=Jestha, 12=Ashad
INSERT INTO fiscal_periods (fiscal_year_bs, bs_year, bs_month, fiscal_month_index) VALUES
    ('2081/082', 2081, 4,  1),
    ('2081/082', 2081, 5,  2),
    ('2081/082', 2081, 6,  3),
    ('2081/082', 2081, 7,  4),
    ('2081/082', 2081, 8,  5),
    ('2081/082', 2081, 9,  6),
    ('2081/082', 2081, 10, 7),
    ('2081/082', 2081, 11, 8),
    ('2081/082', 2081, 12, 9),
    ('2081/082', 2082, 1,  10),
    ('2081/082', 2082, 2,  11),
    ('2081/082', 2082, 3,  12)
ON CONFLICT (bs_year, bs_month) DO NOTHING;
