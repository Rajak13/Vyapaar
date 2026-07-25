# Vyapaaar — Project Context for AI IDE Handoff

This document exists so a new AI model/IDE session can pick up this project with
full context, without the person having to re-explain everything from scratch.
Read this fully before making changes.

---

## 1. What this app is

**Vyapaaar** is a web-based Purchase Register system for a Nepal-based business,
replacing their paper ledger ("bahi-khata"). The client currently records every
purchase by hand in a physical register and wants a web app that feels like a
genuine upgrade — not just digitization for its own sake.

Core constraints that shape every design decision:

- **Nepali fiscal year**: runs Shrawan → Ashad (not Jan–Dec). All reporting,
  "current period" logic, and fiscal-year totals must respect this.
- **Bilingual dates**: every entry must be enterable/viewable in both Bikram
  Sambat (BS) and English/Gregorian (AD) calendars. BS is stored as text
  (e.g. `'2082-04-15'`), AD as a real Postgres `DATE` for querying/sorting.
- **Supplier credit/ledger tracking**: Nepali businesses often pay suppliers
  partially. The client explicitly needs to see, per supplier, how much has
  been purchased, how much paid, and the outstanding balance — this is a core
  feature, not a nice-to-have. (Referred to informally as the "ledger" or
  "leisure" account in earlier planning — it means accounts-payable tracking.)

---

## 2. Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | React + Vite (no Tailwind — plain CSS with custom properties) |
| Backend | Node.js + Express |
| Database | PostgreSQL, hosted on **Neon** |
| Frontend hosting | **Vercel** |
| Backend hosting | **Render** |
| Auth | httpOnly JWT cookie (not localStorage), bcrypt password hashing |

No ORM — raw parameterized `pg` queries throughout. Keep it that way unless
asked to change it.

---

## 3. Design system

**Brand name:** Vyapaaar (yes, three A's — intentional, matches domain).
**Tagline:** "Leave the boring stuff to us"

**Color tokens** (defined in `src/index.css` as CSS custom properties):
```css
--cream:  #fffcf2;
--taupe:  #ccc5b9;
--brown:  #403d39;
--ink:    #252422;
--orange: #eb5e28;
```
Two theme variants toggle via a class on the root element:
```css
.app-dark  { --bg: var(--ink);   --fg: var(--cream); --fg-muted: var(--taupe); --panel: var(--brown); }
.app-light { --bg: var(--cream); --fg: var(--ink);   --fg-muted: var(--brown); --panel: var(--taupe); }
```
Live light/dark toggle exists on both the landing page and dashboard (two
icon buttons — sun/moon — not a single ambiguous switch).

**Typography:** Bricolage Grotesque (display/headings, weights 500/700) +
Inter (body/UI, weights 400/500/600). Loaded via Google Fonts link tags.

**Design principles the client has explicitly asked for:**
- Flat design — **no glassmorphism, no heavy shadows, no gradient-bubble
  "cheap AI" aesthetics.**
- Micro-interactions/hover states on interactive elements (buttons lift,
  invert color, or rotate icons on hover — see `App.css` for the pattern).
- Dashboard cards must have **varied proportions** (bento-style), not a flat
  grid of equal-width/equal-height boxes — that reads as generic/AI-generated.
  Current stats row: one wide accent card + one portrait "ring" card + two
  normal cards, via `grid-template-columns: 1.6fr 0.9fr 0.9fr 0.9fr`.
- Icons are all inline SVG components (hand-written, stroke-based, using
  `currentColor`) — **not an icon font**. An earlier icon-font (Tabler CDN)
  approach was removed because it silently failed to load in some
  environments. Keep using inline SVG for any new icons.

**Landing page hero composition** (`src/App.jsx` in the landing project):
- Navbar: logo + wordmark left, Log in / Register buttons right (with inline
  icons + hover states), no center nav links.
- Giant left-anchored wordmark "VYAPAAAR" (not centered — mirrors a reference
  design where the hero image overlaps the last letter or two intentionally).
- A building photograph (grayscale architectural shot, background-removed to
  a transparent PNG cutout) bleeds from the bottom-right corner, capped at
  `56vh` height so it doesn't dominate the hero.
- A curved SVG ribbon banner (orange, using `<textPath>` along a bezier arc)
  reading "Leave the boring stuff to us · VYAPAAAR ·", confined to the
  bottom-right quadrant — not a full diagonal sweep across the whole hero.
- Bottom-left: CTA pill "Explore Vyapaaar" with an arrow that rotates 45° and
  inverts color on hover.
- Bottom-right: light/dark theme toggle (two icon buttons, cream pill).

---

## 4. Data model

Two schema files exist:

**`schema.sql` (root of the main app)** — the full application schema:
```sql
-- users, business_profile, suppliers, fiscal_periods, purchase_entries,
-- supplier_payments tables, plus two views:
--   supplier_balances      → total purchased / paid / balance_due per supplier
--   purchase_entry_due     → per-invoice paid/due breakdown

CREATE TABLE users (
    id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, full_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE business_profile (
    id SERIAL PRIMARY KEY, taxpayer_name TEXT NOT NULL,
    taxpayer_registration_no TEXT, pan TEXT, address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, pan TEXT,
    phone TEXT, address TEXT, is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fiscal_periods (
    id SERIAL PRIMARY KEY, fiscal_year_bs TEXT NOT NULL,
    bs_year INT NOT NULL, bs_month INT NOT NULL,
    fiscal_month_index INT NOT NULL,  -- 1 = Shrawan ... 12 = Ashad
    UNIQUE (bs_year, bs_month)
);

CREATE TABLE purchase_entries (
    id SERIAL PRIMARY KEY,
    business_profile_id INT NOT NULL REFERENCES business_profile(id),
    fiscal_period_id INT NOT NULL REFERENCES fiscal_periods(id),
    date_bs TEXT NOT NULL, date_ad DATE NOT NULL,
    page_no TEXT, invoice_no TEXT NOT NULL,
    supplier_id INT NOT NULL REFERENCES suppliers(id),
    account_head TEXT,
    tax_exempt_purchases NUMERIC(14,2) NOT NULL DEFAULT 0,
    taxable_purchases NUMERIC(14,2) NOT NULL DEFAULT 0,       -- excl. capital
    taxable_imports NUMERIC(14,2) NOT NULL DEFAULT 0,         -- excl. capital
    capital_taxable_purchases NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_value NUMERIC(14,2) GENERATED ALWAYS AS (
        tax_exempt_purchases + taxable_purchases + taxable_imports + capital_taxable_purchases
    ) STORED,
    grand_total NUMERIC(14,2) GENERATED ALWAYS AS (
        tax_exempt_purchases + taxable_purchases + taxable_imports + capital_taxable_purchases + tax_amount
    ) STORED,
    notes TEXT, created_by INT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE supplier_payments (
    id SERIAL PRIMARY KEY, supplier_id INT NOT NULL REFERENCES suppliers(id),
    purchase_entry_id INT REFERENCES purchase_entries(id),  -- nullable = general credit, not tied to one invoice
    date_bs TEXT NOT NULL, date_ad DATE NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT, reference_no TEXT, notes TEXT,
    created_by INT REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- supplier_balances view: per-supplier total_purchased, total_paid, balance_due
-- purchase_entry_due view: per-invoice grand_total, paid_amount, amount_due
```

**`auth/schema.sql`** — a scoped-down subset used by the auth server on its
own (just the `users` table), since the auth module was built to be droppable
into any backend. If both files end up in the same repo, `users` should only
be created once — reconcile before running both.

Original field-name reference (Nepali → English) that drove this schema:
Taxpayer's Name, Tax Period (Month/Year), Date (मिति), Invoice/Bill Number,
Supplier's Name, Supplier's PAN, Account, Total Purchases, Value (Rs./Paisa),
Tax-Exempt Purchases/Imports, Taxable Purchases (Excl. Capital Goods),
Taxable Imports (Excl. Capital Goods), Capital Taxable Purchases/Imports,
Tax (Rs.), Page No.

---

## 5. Current repo structure

Everything so far lives in one project (`vyapaaar-landing/`), despite earlier
planning discussions about keeping the landing page and the main app
separate — in practice auth and the dashboard shell got merged into this repo.
Treat this as the actual current structure, not the originally planned one:

```
vyapaaar-landing/
├── index.html
├── package.json          (React + Vite, frontend deps)
├── vite.config.js
├── .env                   (gitignored — DATABASE_URL, JWT_SECRET, etc.)
├── public/
│   ├── favicon.svg
│   └── hero-building.png  (transparent-background building cutout)
├── src/
│   ├── main.jsx
│   ├── App.jsx            (routes between landing hero / dashboard based on session state)
│   ├── App.css
│   ├── AuthModal.jsx      (login/register modal — httpOnly cookie flow)
│   ├── AuthModal.css
│   ├── Dashboard.jsx      (main app shell after login — NOW WITH REAL DATA, see below)
│   ├── Dashboard.css
│   ├── Toast.jsx          (notification component, used by AuthModal)
│   ├── Toast.css
│   ├── PurchaseEntryForm.jsx  (CREATE/EDIT/DELETE purchase entries — FULLY IMPLEMENTED)
│   ├── PurchaseRegister.jsx   (LIST/VIEW/EXPORT/DELETE purchase entries — FULLY IMPLEMENTED)
│   ├── Suppliers.jsx      (SUPPLIER CRUD — FULLY IMPLEMENTED)
│   ├── adToBs.js          (AD↔BS date conversion utilities)
│   └── index.css          (color tokens, theme classes)
├── server/                (Express API)
│   ├── package.json       (express, pg, bcrypt, jsonwebtoken, cookie-parser, cors, dotenv, helmet, rate-limit)
│   ├── index.js           (app entry — CORS w/ credentials, cookie-parser, helmet, rate limiting, mounts /auth & /api)
│   ├── routes.js          (auth routes: POST /auth/register, /auth/login, /auth/logout, GET /auth/me)
│   ├── middleware.js      (requireAuth — verifies JWT cookie)
│   └── purchase-entries.js (purchase entries + suppliers routes: GET/POST/PUT/DELETE /api/suppliers, GET/POST/PUT /api/suppliers/:id, GET /api/suppliers/balances, GET/POST /api/purchase-entries, GET/POST/PUT/DELETE /api/purchase-entries/:id, GET /api/purchase-entries/stats)
└── auth/
    ├── schema.sql          (users table only — see note above)
    └── README.md
```

---

## 6. What's actually built vs. what's mock/missing

### ✅ Built and working (UPDATED)

1. **Authentication system, end to end**:
   - `POST /auth/register` — bcrypt hash (12 rounds), inserts user, sets
     httpOnly JWT cookie **with email validation**
   - `POST /auth/login` — constant-time comparison (prevents user-enumeration
     timing attacks), sets cookie
   - `POST /auth/logout` — clears cookie
   - `GET /auth/me` — returns current user from cookie, used for session
     restore on page load
   - `AuthModal.jsx` — tabbed login/register UI, client + server error
     handling, wired to the above
   - `App.jsx` checks session on mount, swaps between landing page and
     Dashboard accordingly
   - **Security enhancements IMPLEMENTED**: helmet.js, rate limiting on auth
     endpoints, CORS locked to FRONTEND_URL, httpOnly cookies

2. **Purchase Entry form** (`PurchaseEntryForm.jsx`) — **FULLY IMPLEMENTED**:
   - Create, edit, and delete purchase entries
   - Supplier search/typeahead with "add new supplier" inline
   - Automatic BS↔AD date conversion
   - Real-time calculation of totals and tax (with optional 13% auto-tax)
   - Form validation with inline error messages
   - Bilingual field labels (English/Nepali)
   - Proper numeric inputs with precision handling
   - Cancel/submit workflow with loading states

3. **Purchase Register list/view** (`PurchaseRegister.jsx`) — **FULLY IMPLEMENTED**:
   - paginated list (20 items/page) with server-side filtering
   - Search by invoice number or supplier name
   - Filter by supplier, date range
   - Column sorting (implicit via date ordering)
   - **CSV export** (client-side generated)
   - Edit/delete actions (both implemented)
   - Loading skeletons, empty states
   - Responsive design

4. **Suppliers management** (`Suppliers.jsx`) — **FULLY IMPLEMENTED**:
   - List view with search and supplier balances (purchased/paid/due)
   - Create/edit/deactivate suppliers (soft delete via `is_active=false`)
   - Toggle active/inactive status
   - Loading skeletons, empty states
   - Responsive design

5. **Dashboard shell** (`Dashboard.jsx`) — **LARGELY IMPLEMENTED WITH REAL DATA**:
   - **Top nav**: search, theme toggle, logout, user info
   - **Left sidebar**: Overview/Purchase Register/Suppliers navigation
   - **Right sidebar**: 
     - Fiscal period card **(STILL USES MOCK DATA — see below)**
     - Spend by supplier card **(NOW REAL DATA from supplier_balances view)**
     - New Purchase action card (opens PurchaseEntryForm)
   - **Main content (when activeNav = 'overview')**:
     - Welcome section with greeting and date
     - **Stats row (bento-style)**:
       * Total Purchases (FY) — **REAL DATA from /api/purchase-entries/stats**
       * Active Suppliers — **REAL DATA from /api/purchase-entries/stats**
       * Pending Payments — **STILL HARDCODDED TO 0** (TODO: wire to supplier_balances)
       * Entries This Month — **REAL DATA from /api/purchase-entries/stats**
     - Recent Purchase Entries table — **REAL DATA from /api/purchase-entries?limit=3**
     - Financial insights row:
       * Tax Breakdown — **STILL USES MOCK DATA** (TODO: add tax summary to stats endpoint)
       * Growth Index — **STILL SVG PLACEHOLDER** (TODO: replace with real chart)
   - **FIXED ISSUES**: 
     - Removed redundant auth check that was causing 401 errors
     - Fixed function structure causing ReferenceError
     - Properly scoped handler functions and JSX return statement
     - Component now loads correctly when user prop is provided by App.jsx

### ⚠️ What's still using mock data (needs wiring to real endpoints):

1. **Fiscal period data in dashboard** (`MOCK_FISCAL`):
   - Currently hardcoded in Dashboard.jsx
   - **NEEDS**: endpoint like `GET /api/fiscal-periods/current` or similar
   - The purchase-entries API already accepts `fiscal_period_id` filters, so
     the backend can support this

2. **Tax breakdown in dashboard** (`MOCK_TAX`):
   - Currently hardcoded VAT values
   - **NEEDS**: tax aggregation in `/api/purchase-entries/stats` endpoint
     (e.g., `tax_total` field)

3. **Pending payments statistic**:
   - Currently hardcoded to 0
   - **NEEDS**: either:
     a) Extend `supplier_balances` view to include payment totals, OR
     b) Add a separate endpoint for payment stats, OR
     c) Calculate from `supplier_payments` table (once payment UI is built)

4. **Growth index chart**:
   - Currently a hardcoded SVG placeholder
   - **NEEDS**: real chart implementation (could use Chart.js, Recharts, etc.)
     showing month-over-month or QoQ purchasing trends

### ❌ What still needs to be built:

1. **Export system** (EXPLICIT CLIENT PRIORITY):
   - ❌ **PDF export** matching official IRD register format **(NOT STARTED)**
   - ✅ CSV export **IMPLEMENTED** in PurchaseRegister.jsx (client-side)
   - ❌ Excel/XLSX export **(NOT STARTED)** — though CSV covers basic need

2. **Payment tracking system**:
   - Schema exists for `supplier_payments` table
   - ❌ **No UI** to record payments against suppliers or specific invoices
   - ❌ **No API endpoints** for `/api/supplier-payments` (GET/POST)
   - The dashboard button currently says "Log a new purchase invoice or payment"
     but only opens the purchase entry form — this needs to be split or expanded

3. **Fiscal period management**:
   - While the `fiscal_periods` table exists and is referenced by
     `purchase_entries`, there's no CRUD interface for managing fiscal periods
   - The system currently relies on pre-populated data or defaults to first
     record found
   - **NEEDS**:
     - API endpoints: `GET/POST/PUT /api/fiscal-periods`
     - UI to view/set current fiscal period, add historical periods

4. **Advanced reporting / analytics** (future enhancement):
   - Custom date range reports
   - Tax liability reports
   - Supplier aging reports
   - Data visualization improvements

---

## 7. Immediate next milestone (based on actual state)

The realistic next step, in order:

1. **Complete dashboard real-data wiring** (quick wins):
   - Implement/fiscal period endpoint and wire to dashboard
   - Add tax totals to `/api/purchase-entries/stats` endpoint
   - Wire pending payments to use `supplier_balances` view (requires joining
     with `supplier_payments` once payment system exists, or calculate
     `total_purchased - COALESCE(total_paid, 0)` if we infer paid from context)

2. **Begin export system** (client priority):
   - **Start with PDF** to match official IRD register format
   - Consider using a library like `pdfkit` or `jspdf` with auto-table
   - Generate PDFs that match the Nepali government's prescribed format

3. **Begin payment tracking**:
   - Build UI to record payments (likely in Suppliers view or a new Payments view)
   - Create `/api/supplier-payments` endpoints (GET list, POST create)
   - Update dashboard pending payments calculation to use actual payment data

4. **Enhance charts/visualizations**:
   - Replace SVG placeholder in dashboard with real chart library
   - Consider adding trend charts to reports/exports

**Note**: The purchase entry form, register, and supplier management are
**fully functional** (including create, read, update, delete) and capable of
replacing the paper ledger today. The remaining work enhances usability and
meets specific client requests (PDF export, fiscal year adherence, etc.).

---

## 8. How to verify current state locally

```bash
# Frontend
npm install
npm run dev          # Vite dev server, default http://localhost:5173

# Backend (separate terminal)
cd server
npm install
npm run dev           # Express on http://localhost:3001 (or $PORT)
```

Required `.env` variables (not committed — ask the client/project owner for
actual values, don't invent placeholders and assume they work):
```
DATABASE_URL=postgres://...        (Neon connection string)
JWT_SECRET=...
JWT_EXPIRES_IN=7d
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
PORT=3001
```

Before the backend will run against a fresh database, run `schema.sql` (root)
against it — check whether `auth/schema.sql`'s `users` table conflicts with
the root schema's `users` table if both get applied to the same database
(they currently define the same table twice in two files).

To sanity-check what's real vs. mock: search `Dashboard.jsx` for `MOCK_` —
every one of those constants is fake data standing in for a query that
hasn't been built yet **EXCEPT**:
- The stats cards (total purchases, active suppliers, entries this month) now
  use real data from `/api/purchase-entries/stats`
- The supplier spend chart in the right sidebar uses real data from
  `/api/suppliers/balances`

Everything else marked `MOCK_` or with `TODO:` comments still needs work.