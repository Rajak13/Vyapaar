/**
 * DB Migration 3: Add opening_balance to suppliers, and is_missed_bill / claimed_fiscal_period_id to purchase_entries.
 * Safe and idempotent.
 */
import pg from 'pg'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

const { Pool } = pg
const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('DATABASE_URL is missing in environment.')
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL?.includes('sslmode') ? { rejectUnauthorized: false } : false,
})

async function migrate3() {
  const client = await pool.connect()
  try {
    console.log('Starting Migration 3...')
    await client.query('BEGIN')

    // 1. Add opening_balance to suppliers
    await client.query(`
      ALTER TABLE suppliers
        ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0
    `)
    console.log('✅ suppliers.opening_balance added')

    // 2. Add is_missed_bill to purchase_entries
    await client.query(`
      ALTER TABLE purchase_entries
        ADD COLUMN IF NOT EXISTS is_missed_bill BOOLEAN NOT NULL DEFAULT false
    `)
    console.log('✅ purchase_entries.is_missed_bill added')

    // 3. Add claimed_fiscal_period_id to purchase_entries
    await client.query(`
      ALTER TABLE purchase_entries
        ADD COLUMN IF NOT EXISTS claimed_fiscal_period_id INT REFERENCES fiscal_periods(id)
    `)
    console.log('✅ purchase_entries.claimed_fiscal_period_id added')

    await client.query('COMMIT')
    console.log('\n🎉 Migration 3 finished successfully!')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Migration 3 failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate3()
