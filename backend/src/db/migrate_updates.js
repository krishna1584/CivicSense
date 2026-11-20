// Schema changes made after the original migrations. Idempotent: runs before every start.
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

    // One-time codes are stored as a 64-character keyed hash, with a wrong-guess counter.
    await client.query('ALTER TABLE users ALTER COLUMN otp_code TYPE VARCHAR(64)');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_attempts SMALLINT NOT NULL DEFAULT 0');

    // Case-insensitive email lookups
    await client.query('CREATE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email))');

    await client.query('COMMIT');
    console.log('Schema updates applied');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Schema update failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
