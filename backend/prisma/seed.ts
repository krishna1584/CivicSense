import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      name: 'Test User',
      email: 'test@example.com',
      password_hash: '$2b$10$placeholder', // In production, use proper hashing
      role: 'citizen',
      is_verified: true,
      is_active: true,
    },
  });

  console.log(`✅ Created test user: ${testUser.email}`);

  // Create a test admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@example.com',
      password_hash: '$2b$10$placeholder',
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
