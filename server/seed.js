/**
 * Production Seed Script
 * - Clears all data from users, suppliers, purchase_entries, supplier_payments,
 *   business_profile, fiscal_periods
 * - Creates testuser123@gmail.com / Test123@
 * - Seeds 13 months of realistic purchase data:
 *     FY 2082/083 (all 12 months) + 2083 Shrawan (FY 2083/084 month 1)
 *
 * Run: node seed.js
 */

import pg      from 'pg'
import bcrypt  from 'bcrypt'
import dotenv  from 'dotenv'
import crypto  from 'crypto'
dotenv.config()

// ─── Safety Guard ─────────────────────────────────────────────────────────────
// Prevent accidental production wipes. Must set ALLOW_PROD_SEED=true explicitly.
if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PROD_SEED) {
  console.error(
    '\n❌  REFUSED: Seed script blocked in production.\n' +
    '    Set ALLOW_PROD_SEED=true explicitly to override.\n'
  )
  process.exit(1)
}

const { Pool } = pg
const DB_URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
const pool   = new Pool({
  connectionString: DB_URL,
  ssl: DB_URL?.includes('sslmode') ? { rejectUnauthorized: false } : false,
})

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Pad a number to 2 digits */
const p2 = n => String(n).padStart(2, '0')

/** Return a random integer in [min, max] */
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

/** Round to 2 decimal places */
const r2 = n => Math.round(n * 100) / 100

/** Pick a random element from an array */
const pick = arr => arr[rand(0, arr.length - 1)]

// ─── BS → approximate AD date mapping (middle of each BS month) ────────────────
// Format: [bsYear, bsMonth] → AD date string 'YYYY-MM-DD'
const BS_TO_AD_MID = {
  '2082-4':  '2025-07-25', '2082-5':  '2025-08-25', '2082-6':  '2025-09-25',
  '2082-7':  '2025-10-25', '2082-8':  '2025-11-25', '2082-9':  '2025-12-22',
  '2082-10': '2026-01-20', '2082-11': '2026-02-18', '2082-12': '2026-03-20',
  '2083-1':  '2026-04-25', '2083-2':  '2026-05-22', '2083-3':  '2026-06-20',
  '2083-4':  '2026-07-25',
}

// Spread entries within a month (±10 days from mid)
function bsMonthDates(bsYear, bsMonth, count) {
  const mid = new Date(BS_TO_AD_MID[`${bsYear}-${bsMonth}`])
  const dates = []
  for (let i = 0; i < count; i++) {
    const offset = rand(-9, 9)
    const d = new Date(mid)
    d.setDate(d.getDate() + offset)
    const ad = d.toISOString().split('T')[0]
    const bs = `${bsYear}-${p2(bsMonth)}-${p2(rand(1, 25))}`
    dates.push({ ad, bs })
  }
  return dates.sort((a, b) => a.ad.localeCompare(b.ad))
}

// ─── Master Data ───────────────────────────────────────────────────────────────

const SUPPLIERS = [
  { name: 'Himalayan Trading Pvt. Ltd.',    pan: '302145678', phone: '014423891', address: 'New Road, Kathmandu' },
  { name: 'Nepal Pharma Distributors',      pan: '302987654', phone: '014567234', address: 'Putalisadak, Kathmandu' },
  { name: 'Kathmandu Supply Co.',           pan: '303456789', phone: '014234567', address: 'Asan, Kathmandu' },
  { name: 'Everest FMCG Pvt. Ltd.',         pan: '302234567', phone: '014678901', address: 'Baneshwor, Kathmandu' },
  { name: 'Buddha Electronics',             pan: '301876543', phone: '014789012', address: 'New Baneshwor, Kathmandu' },
  { name: 'Annapurna Industries Ltd.',      pan: '303765432', phone: '021523456', address: 'Pokhara, Gandaki' },
  { name: 'Sagarmatha Imports Pvt. Ltd.',   pan: '302543210', phone: '014345678', address: 'Kalimati, Kathmandu' },
  { name: 'Ganesh Trading House',           pan: '301234567', phone: '014456789', address: 'Thamel, Kathmandu' },
]

const ACCOUNT_HEADS = [
  'General Purchases', 'Capital Goods', 'Raw Materials',
  'Packaging Materials', 'Office Supplies', 'Spare Parts & Equipment',
]

// ─── Fiscal Periods ────────────────────────────────────────────────────────────
// FY 2082/083: months 4-12 of 2082 (index 1-9) + months 1-3 of 2083 (index 10-12)
// FY 2083/084: month 4 of 2083 (index 1) only
const FISCAL_PERIODS = [
  // 2082/083
  { label: '2082/083', bsYear: 2082, bsMonth: 4,  idx: 1  },
  { label: '2082/083', bsYear: 2082, bsMonth: 5,  idx: 2  },
  { label: '2082/083', bsYear: 2082, bsMonth: 6,  idx: 3  },
  { label: '2082/083', bsYear: 2082, bsMonth: 7,  idx: 4  },
  { label: '2082/083', bsYear: 2082, bsMonth: 8,  idx: 5  },
  { label: '2082/083', bsYear: 2082, bsMonth: 9,  idx: 6  },
  { label: '2082/083', bsYear: 2082, bsMonth: 10, idx: 7  },
  { label: '2082/083', bsYear: 2082, bsMonth: 11, idx: 8  },
  { label: '2082/083', bsYear: 2082, bsMonth: 12, idx: 9  },
  { label: '2082/083', bsYear: 2083, bsMonth: 1,  idx: 10 },
  { label: '2082/083', bsYear: 2083, bsMonth: 2,  idx: 11 },
  { label: '2082/083', bsYear: 2083, bsMonth: 3,  idx: 12 },
  // 2083/084
  { label: '2083/084', bsYear: 2083, bsMonth: 4,  idx: 1  },
]

// ─── Entry generation ──────────────────────────────────────────────────────────
// Each month gets 3-5 entries across different suppliers
function makeEntries(fpId, bsYear, bsMonth, supplierIds, bpId, userId) {
  const count   = rand(3, 5)
  const dates   = bsMonthDates(bsYear, bsMonth, count)
  const entries = []

  for (let i = 0; i < count; i++) {
    const suppId    = pick(supplierIds)
    const { ad, bs } = dates[i]
    const invoiceNo = `INV-${bsYear}${p2(bsMonth)}-${p2(rand(1, 99))}`
    const accountHead = pick(ACCOUNT_HEADS)

    // Realistic purchase breakdown
    const taxable    = r2(rand(5000, 120000))
    const taxExempt  = rand(0, 1) ? r2(rand(1000, 30000)) : 0
    const taxImport  = rand(0, 1) ? r2(rand(2000, 20000)) : 0
    const capTaxable = rand(0, 3) === 0 ? r2(rand(10000, 80000)) : 0 // less frequent
    const taxAmt     = r2(taxable * 0.13 + taxImport * 0.13)
    const totalValue = r2(taxExempt + taxable + taxImport + capTaxable)
    const grandTotal = r2(totalValue + taxAmt)

    entries.push({
      suppId, fpId, bpId, bsYear, bsMonth,
      date_bs: bs, date_ad: ad, invoiceNo,
      accountHead, taxExempt, taxable, taxImport, capTaxable,
      taxAmt, totalValue, grandTotal, userId,
    })
  }
  return entries
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  const client = await pool.connect()
  try {
    console.log('\n🌱  Starting production seed...\n')
    await client.query('BEGIN')

    // ── 1. Clear all data ──────────────────────────────────────────────────────
    console.log('🗑   Clearing existing data...')
    await client.query('DELETE FROM supplier_payments')
    await client.query('DELETE FROM purchase_entries')
    await client.query('DELETE FROM suppliers')
    await client.query('DELETE FROM business_profile')
    await client.query('DELETE FROM fiscal_periods')
    await client.query('DELETE FROM users')
    console.log('    ✓ All tables cleared\n')

    // ── 2. Create test user ────────────────────────────────────────────────────
    // Generate a random password at runtime — never committed to source.
    const generatedPassword = crypto.randomBytes(12).toString('base64url')
    console.log('👤  Creating seed user...')
    const hash = await bcrypt.hash(generatedPassword, 12)
    const { rows: [user] } = await client.query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3) RETURNING id`,
      ['testuser123@gmail.com', hash, 'Test User']
    )
    const userId = user.id
    console.log(`    ✓ User created (id=${userId})\n`)

    // ── 3. Business profile ────────────────────────────────────────────────────
    console.log('🏢  Creating business profile...')
    const { rows: [bp] } = await client.query(
      `INSERT INTO business_profile
         (taxpayer_name, taxpayer_registration_no, pan, address, user_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      ['Vyapaar Trading Pvt. Ltd.', 'REG-2079-01234', '305678901',
       'Tripureshwor, Kathmandu', userId]
    )
    const bpId = bp.id
    console.log(`    ✓ Business profile created (id=${bpId})\n`)

    // ── 4. Fiscal periods ──────────────────────────────────────────────────────
    console.log('📅  Seeding fiscal periods...')
    const fpMap = {} // key: 'bsYear-bsMonth' → id
    for (const fp of FISCAL_PERIODS) {
      const { rows: [row] } = await client.query(
        `INSERT INTO fiscal_periods
           (fiscal_year_bs, bs_year, bs_month, fiscal_month_index, user_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [fp.label, fp.bsYear, fp.bsMonth, fp.idx, userId]
      )
      fpMap[`${fp.bsYear}-${fp.bsMonth}`] = row.id
    }
    console.log(`    ✓ ${FISCAL_PERIODS.length} fiscal periods created\n`)

    // ── 5. Suppliers ───────────────────────────────────────────────────────────
    console.log('🏪  Creating suppliers...')
    const supplierIds = []
    for (const s of SUPPLIERS) {
      const { rows: [row] } = await client.query(
        `INSERT INTO suppliers (name, pan, phone, address, user_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [s.name, s.pan, s.phone, s.address, userId]
      )
      supplierIds.push(row.id)
    }
    console.log(`    ✓ ${SUPPLIERS.length} suppliers created\n`)

    // ── 6. Purchase entries ────────────────────────────────────────────────────
    console.log('📝  Generating purchase entries...')
    const allEntries = []
    for (const fp of FISCAL_PERIODS) {
      const fpId = fpMap[`${fp.bsYear}-${fp.bsMonth}`]
      const batch = makeEntries(fpId, fp.bsYear, fp.bsMonth, supplierIds, bpId, userId)
      allEntries.push(...batch)
    }

    // Insert entries and collect {id, suppId, grandTotal}
    const entryRecords = []
    for (const e of allEntries) {
      const { rows: [row] } = await client.query(
        `INSERT INTO purchase_entries (
           business_profile_id, fiscal_period_id, date_bs, date_ad,
           invoice_no, supplier_id, account_head,
           tax_exempt_purchases, taxable_purchases, taxable_imports,
           capital_taxable_purchases, tax_amount,
           notes, user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING id, grand_total`,
        [
          e.bpId, e.fpId, e.date_bs, e.date_ad, e.invoiceNo,
          e.suppId, e.accountHead,
          e.taxExempt, e.taxable, e.taxImport, e.capTaxable,
          e.taxAmt,
          null, userId,
        ]
      )
      entryRecords.push({ id: row.id, suppId: e.suppId, grandTotal: parseFloat(row.grand_total), date_ad: e.date_ad, date_bs: e.date_bs })
    }
    console.log(`    ✓ ${entryRecords.length} purchase entries created\n`)

    // ── 7. Supplier payments ───────────────────────────────────────────────────
    console.log('💸  Generating supplier payments...')
    const METHODS = ['cash', 'online', 'cheque']
    let payCount = 0

    for (const entry of entryRecords) {
      // ~70% of entries get at least a payment; ~30% fully paid; ~25% partial; ~15% unpaid
      const roll = rand(1, 100)
      if (roll <= 15) continue  // 15% — no payment (outstanding)

      const payDate = new Date(entry.date_ad)
      payDate.setDate(payDate.getDate() + rand(1, 20)) // paid 1-20 days after invoice
      const adStr = payDate.toISOString().split('T')[0]

      // Rough BS date (offset same days)
      const bsParts = entry.date_bs.split('-')
      const bsDay   = Math.min(parseInt(bsParts[2]) + rand(1, 20), 30)
      const bsStr   = `${bsParts[0]}-${bsParts[1]}-${p2(bsDay)}`

      const method  = pick(METHODS)
      const refNo   = method === 'cheque' ? `CHQ-${rand(100000, 999999)}` : null

      if (roll <= 45) {
        // Partial payment (~30% of entries)
        const partialAmt = r2(entry.grandTotal * (rand(30, 70) / 100))
        await client.query(
          `INSERT INTO supplier_payments
             (supplier_id, purchase_entry_id, date_bs, date_ad,
              amount, payment_method, reference_no, notes, user_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [entry.suppId, entry.id, bsStr, adStr,
           partialAmt, method, refNo, 'Partial settlement', userId]
        )
        payCount++
      } else {
        // Full payment (~55% of entries)
        await client.query(
          `INSERT INTO supplier_payments
             (supplier_id, purchase_entry_id, date_bs, date_ad,
              amount, payment_method, reference_no, notes, user_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [entry.suppId, entry.id, bsStr, adStr,
           entry.grandTotal, method, refNo, 'Full payment', userId]
        )
        payCount++
      }
    }
    console.log(`    ✓ ${payCount} payments recorded\n`)

    await client.query('COMMIT')

    // ── Summary ────────────────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════')
    console.log('✅  Seed complete!')
    console.log('═══════════════════════════════════════')
    console.log(`  Email   : testuser123@gmail.com`)
    console.log(`  Password: ${generatedPassword}   ← SAVE THIS — shown only once`)
    console.log(`  User ID : ${userId}`)
    console.log(`  Business: Vyapaar Trading Pvt. Ltd.`)
    console.log(`  Fiscal  : 2082/083 (12 months) + 2083 Shrawan`)
    console.log(`  Entries : ${entryRecords.length}`)
    console.log(`  Payments: ${payCount}`)
    console.log(`  Suppliers: ${SUPPLIERS.length}`)
    console.log('═══════════════════════════════════════\n')

  } catch (err) {
    await client.query('ROLLBACK')
    console.error('\n❌  Seed failed:\n', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
