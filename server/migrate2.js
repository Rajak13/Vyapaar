/**
 * DB Migration 2: Schema consistency improvements
 *
 * 1. Rename `created_by` → `user_id` on purchase_entries and supplier_payments
 *    (matches the naming convention of suppliers/business_profile/fiscal_periods)
 * 2. Add UNIQUE (user_id, name) constraint on suppliers to prevent race-condition
 *    duplicate rows and to support ON CONFLICT upserts in the API.
 *
 * Run once: node server/migrate2.js
 * This migration is idempotent — safe to run multiple times.
 */
import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const { Pool } = pg
const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL?.includes('sslmode') ? { rejectUnauthorized: false } : false,
})

async function migrate2() {
  const client = await pool.connect()
  try {
    console.log('Starting migration 2...')
    await client.query('BEGIN')

    // 1. Rename created_by → user_id on purchase_entries (idempotent)
    const { rows: pe_cols } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'purchase_entries' AND column_name = 'created_by'
    `)
    if (pe_cols.length > 0) {
      await client.query(`ALTER TABLE purchase_entries RENAME COLUMN created_by TO user_id`)
      console.log('✅ purchase_entries.created_by renamed to user_id')
    } else {
      console.log('ℹ️  purchase_entries.user_id already exists — skipping rename')
    }

    // 2. Rename created_by → user_id on supplier_payments (idempotent)
    const { rows: sp_cols } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'supplier_payments' AND column_name = 'created_by'
    `)
    if (sp_cols.length > 0) {
      await client.query(`ALTER TABLE supplier_payments RENAME COLUMN created_by TO user_id`)
      console.log('✅ supplier_payments.created_by renamed to user_id')
    } else {
      console.log('ℹ️  supplier_payments.user_id already exists — skipping rename')
    }

    // 3. Add UNIQUE (user_id, name) constraint on suppliers (idempotent)
    const { rows: conRows } = await client.query(`
      SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_user_name_unique'
    `)
    if (conRows.length === 0) {
      await client.query(`
        ALTER TABLE suppliers
          ADD CONSTRAINT suppliers_user_name_unique UNIQUE (user_id, name)
      `)
      console.log('✅ suppliers UNIQUE (user_id, name) constraint added')
    } else {
      console.log('ℹ️  suppliers_user_name_unique already exists — skipping')
    }

    await client.query('COMMIT')
    console.log('\n✅ Migration 2 complete!')
    console.log('\nIMPORTANT: After running this migration, update your server/purchase-entries.js')
    console.log('to use user_id instead of created_by in all queries, then redeploy.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Migration 2 failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate2()
