-- ============================================================
-- Vyapaaar Full Schema (v1) — run once against Vyapaar_DB
-- ============================================================

-- Users (already exists, skip if so)
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Business profile
CREATE TABLE IF NOT EXISTS business_profile (
    id                      SERIAL PRIMARY KEY,
    taxpayer_name           TEXT NOT NULL,
    taxpayer_registration_no TEXT,
    pan                     TEXT,
    address                 TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    pan         TEXT,
    phone       TEXT,
    address     TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers (name);
CREATE INDEX IF NOT EXISTS idx_suppliers_pan  ON suppliers (pan);

-- Fiscal periods
CREATE TABLE IF NOT EXISTS fiscal_periods (
    id                  SERIAL PRIMARY KEY,
    fiscal_year_bs      TEXT NOT NULL,
    bs_year             INT NOT NULL,
    bs_month            INT NOT NULL,
    fiscal_month_index  INT NOT NULL,
    UNIQUE (bs_year, bs_month)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_periods_fy ON fiscal_periods (fiscal_year_bs);

-- Purchase entries
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
    created_by                  INT REFERENCES users(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_entries_supplier ON purchase_entries (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_entries_fiscal   ON purchase_entries (fiscal_period_id);
CREATE INDEX IF NOT EXISTS idx_purchase_entries_date_ad  ON purchase_entries (date_ad);
CREATE INDEX IF NOT EXISTS idx_purchase_entries_invoice  ON purchase_entries (invoice_no);

-- Supplier payments
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
    created_by          INT REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_entry    ON supplier_payments (purchase_entry_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date_ad  ON supplier_payments (date_ad);

-- Views
CREATE OR REPLACE VIEW supplier_balances AS
SELECT
    s.id                                    AS supplier_id,
    s.name                                  AS supplier_name,
    s.pan                                   AS supplier_pan,
    COALESCE(SUM(pe.grand_total), 0)        AS total_purchased,
    COALESCE(paid.total_paid, 0)            AS total_paid,
    COALESCE(SUM(pe.grand_total), 0) - COALESCE(paid.total_paid, 0) AS balance_due
FROM suppliers s
LEFT JOIN purchase_entries pe ON pe.supplier_id = s.id
LEFT JOIN (
    SELECT supplier_id, SUM(amount) AS total_paid
    FROM supplier_payments
    GROUP BY supplier_id
) paid ON paid.supplier_id = s.id
GROUP BY s.id, s.name, s.pan, paid.total_paid;

CREATE OR REPLACE VIEW purchase_entry_due AS
SELECT
    pe.id                                   AS purchase_entry_id,
    pe.supplier_id,
    pe.invoice_no,
    pe.date_ad,
    pe.grand_total,
    COALESCE(paid.paid_amount, 0)           AS paid_amount,
    pe.grand_total - COALESCE(paid.paid_amount, 0) AS amount_due
FROM purchase_entries pe
LEFT JOIN (
    SELECT purchase_entry_id, SUM(amount) AS paid_amount
    FROM supplier_payments
    WHERE purchase_entry_id IS NOT NULL
    GROUP BY purchase_entry_id
) paid ON paid.purchase_entry_id = pe.id;

-- Seed: default business profile (required FK for purchase_entries)
INSERT INTO business_profile (taxpayer_name)
VALUES ('My Business')
ON CONFLICT DO NOTHING;

-- Seed: current fiscal period 2081/82 Shrawan (month index 1)
INSERT INTO fiscal_periods (fiscal_year_bs, bs_year, bs_month, fiscal_month_index)
VALUES ('2081/82', 2081, 4, 1)
ON CONFLICT (bs_year, bs_month) DO NOTHING;
