// Idempotent: safe to run on every deploy.
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Anonymous reports have no owner at all.
    await client.query('ALTER TABLE issues ALTER COLUMN user_id DROP NOT NULL');

    await client.query(`
      ALTER TABLE issues
        ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'approved',
        ADD COLUMN IF NOT EXISTS publish_after TIMESTAMPTZ
    `);
    await client.query('CREATE INDEX IF NOT EXISTS issues_moderation_idx ON issues (moderation_status, publish_after)');

    // Kept apart from issues so `SELECT i.*` can never expose a token hash.
    await client.query(`
      CREATE TABLE IF NOT EXISTS anonymous_report_tokens (
        issue_id   UUID PRIMARY KEY REFERENCES issues(id) ON DELETE CASCADE,
        token_hash CHAR(64) NOT NULL UNIQUE
      )
    `);

    await client.query('COMMIT');
    console.log('Anonymous reporting migration complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Anonymous reporting migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
