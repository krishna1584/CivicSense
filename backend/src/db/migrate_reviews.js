require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running review system migration...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS issue_reviews (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        issue_id        UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_user_id  UUID REFERENCES users(id) ON DELETE CASCADE,
        rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment         TEXT,
        is_hidden       BOOLEAN NOT NULL DEFAULT FALSE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (issue_id, user_id)
      )
    `);
    console.log('✓ issue_reviews table created');

    await client.query(`
      ALTER TABLE issue_reviews
        ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES users(id) ON DELETE CASCADE
    `);
    console.log('✓ target_user_id column added to issue_reviews if not exists');

    await client.query(`
      ALTER TABLE issues
        ADD COLUMN IF NOT EXISTS avg_rating    NUMERIC(3,2),
        ADD COLUMN IF NOT EXISTS review_count  INTEGER NOT NULL DEFAULT 0
    `);
    console.log('✓ avg_rating and review_count columns added to issues');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_issue_reviews_issue_id ON issue_reviews(issue_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_issue_reviews_user_id ON issue_reviews(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_issue_reviews_target_user_id ON issue_reviews(target_user_id)
    `);
    console.log('✓ Indexes created');

    console.log('\n✅ Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
