require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('🌱 Seeding database...');

  // Create categories
  const categories = [
    { name: 'Traffic', slug: 'traffic', icon: '🚦', description: 'Traffic and road safety issues' },
    { name: 'Pothole', slug: 'pothole', icon: '🕳️', description: 'Road damage and potholes' },
    { name: 'Lighting', slug: 'lighting', icon: '💡', description: 'Street lighting problems' },
    { name: 'Pollution', slug: 'pollution', icon: '💨', description: 'Air/noise pollution' },
    { name: 'Flooding', slug: 'flooding', icon: '🌊', description: 'Water/drainage issues' },
    { name: 'Garbage', slug: 'garbage', icon: '🗑️', description: 'Waste and sanitation' },
    { name: 'Parks', slug: 'parks', icon: '🌳', description: 'Park maintenance' },
    { name: 'Other', slug: 'other', icon: '📌', description: 'Other civic issues' },
  ];

  for (const cat of categories) {
    await pool.query(`
      INSERT INTO categories (id, name, slug, icon, description)
      VALUES (gen_random_uuid(), $1, $2, $3, $4)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, description = EXCLUDED.description
    `, [cat.name, cat.slug, cat.icon, cat.description]);
  }

  console.log(`✅ Created ${categories.length} categories`);

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
