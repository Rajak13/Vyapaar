/**
 * DB Migration: Add user_id to shared tables for multi-tenant data isolation.
 * Run once on the Neon database.
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

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('Starting migration...')
    await client.query('BEGIN')

    // 1. Add user_id to suppliers
    await client.query(`
      ALTER TABLE suppliers
        ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE
    `)
    await client.query(`
      UPDATE suppliers
        SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1)
        WHERE user_id IS NULL
    `)
    console.log('✅ suppliers.user_id added and backfilled')

    // 2. Add user_id to business_profile
    await client.query(`
      ALTER TABLE business_profile
        ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE
    `)
    await client.query(`
      UPDATE business_profile
        SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1)
        WHERE user_id IS NULL
    `)
    console.log('✅ business_profile.user_id added and backfilled')

    // 3. Add user_id to fiscal_periods
    await client.query(`
      ALTER TABLE fiscal_periods
        ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE
    `)
    await client.query(`
      UPDATE fiscal_periods
        SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1)
        WHERE user_id IS NULL
    `)
    console.log('✅ fiscal_periods.user_id added and backfilled')

    // 4. Update unique constraint on fiscal_periods to include user_id
    await client.query(`
      ALTER TABLE fiscal_periods
        DROP CONSTRAINT IF EXISTS fiscal_periods_bs_year_bs_month_key
    `)
    // Add new constraint only if it doesn't exist
    const { rows: conRows } = await client.query(`
      SELECT 1 FROM pg_constraint WHERE conname = 'fiscal_periods_user_bs_year_bs_month_key'
    `)
    if (conRows.length === 0) {
      await client.query(`
        ALTER TABLE fiscal_periods
          ADD CONSTRAINT fiscal_periods_user_bs_year_bs_month_key
          UNIQUE (user_id, bs_year, bs_month)
      `)
    }
    console.log('✅ fiscal_periods unique constraint updated to include user_id')

    await client.query('COMMIT')
    console.log('✅ Migration complete!')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
