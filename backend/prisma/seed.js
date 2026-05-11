require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

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
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
  }

  console.log(`✅ Created ${categories.length} categories`);

  // Create a test user
  const hashedPassword = await bcrypt.hash('password', 10);
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {
      name: 'Test User',
      password_hash: hashedPassword,
      role: 'citizen',
      is_verified: true,
      is_active: true,
    },
    create: {
      name: 'Test User',
      email: 'test@example.com',
      password_hash: hashedPassword,
      role: 'citizen',
      is_verified: true,
      is_active: true,
    },
  });

  console.log(`✅ Created test user: ${testUser.email}`);

  // Create a test admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      name: 'Admin User',
      password_hash: hashedPassword,
      role: 'admin',
      is_verified: true,
      is_active: true,
    },
    create: {
      name: 'Admin User',
      email: 'admin@example.com',
      password_hash: hashedPassword,
      role: 'admin',
      is_verified: true,
      is_active: true,
    },
  });

  console.log(`✅ Created admin user: ${adminUser.email}`);

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
