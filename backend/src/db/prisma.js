const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

// Enable PostGIS and other extensions if needed
const pool = new Pool({ 
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

module.exports = prisma;