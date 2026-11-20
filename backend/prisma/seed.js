require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function main() {
  // These demo accounts use a well-known password, so they must never reach a live database.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo accounts in production');
  }
  console.log('🌱 Seeding demo accounts...');
  // Categories come from src/db/migrate.js, the single source for them.

  const hashedPassword = await bcrypt.hash('password', 10);

  // Create test user
  await pool.query(`
    INSERT INTO users (id, name, email, password_hash, role, is_verified, is_active)
    VALUES (gen_random_uuid(), 'Test User', 'test@example.com', $1, 'citizen', TRUE, TRUE)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, is_verified = EXCLUDED.is_verified, is_active = EXCLUDED.is_active
  `, [hashedPassword]);

  console.log(`✅ Created test user: test@example.com`);

  // Create admin user
  await pool.query(`
    INSERT INTO users (id, name, email, password_hash, role, is_verified, is_active)
    VALUES (gen_random_uuid(), 'Admin User', 'admin@example.com', $1, 'admin', TRUE, TRUE)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, is_verified = EXCLUDED.is_verified, is_active = EXCLUDED.is_active
  `, [hashedPassword]);

  console.log(`✅ Created admin user: admin@example.com`);

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
