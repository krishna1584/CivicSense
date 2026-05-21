const pool = require('./pool');
require('dotenv').config();

const migrate = async () => {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');

    await client.query('BEGIN');

    // Enable PostGIS
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');

    // ENUM types
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('citizen', 'admin', 'department_staff');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE issue_status AS ENUM ('reported', 'acknowledged', 'in_progress', 'resolved', 'rejected');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE severity_level AS ENUM ('low', 'medium', 'high', 'critical');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE vote_type AS ENUM ('upvote', 'downvote');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE media_type AS ENUM ('image', 'video');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role user_role NOT NULL DEFAULT 'citizen',
        trust_score INTEGER DEFAULT 0,
        avatar_url TEXT,
        is_verified BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Refresh tokens
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Categories
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(100) NOT NULL UNIQUE,
        icon VARCHAR(50),
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Sub-categories
    await client.query(`
      CREATE TABLE IF NOT EXISTS subcategories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Issues
    await client.query(`
      CREATE TABLE IF NOT EXISTS issues (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category_id UUID REFERENCES categories(id),
        subcategory_id UUID REFERENCES subcategories(id),
        severity severity_level NOT NULL DEFAULT 'medium',
        status issue_status NOT NULL DEFAULT 'reported',
        location GEOGRAPHY(Point, 4326),
        address TEXT,
        is_anonymous BOOLEAN DEFAULT FALSE,
        upvote_count INTEGER DEFAULT 0,
        downvote_count INTEGER DEFAULT 0,
        follow_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        assigned_to UUID REFERENCES users(id),
        department VARCHAR(255),
        sla_hours INTEGER,
        sla_deadline TIMESTAMPTZ,
        rejection_reason TEXT,
        search_vector TSVECTOR,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      );
    `);

    // Spatial index on location
    await client.query(`
      CREATE INDEX IF NOT EXISTS issues_location_idx ON issues USING GIST (location);
    `);

    // Full-text search index
    await client.query(`
      CREATE INDEX IF NOT EXISTS issues_search_idx ON issues USING GIN (search_vector);
    `);

    // Trigger to update search_vector
    await client.query(`
      CREATE OR REPLACE FUNCTION update_issue_search_vector()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.description, ''));
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS issue_search_vector_update ON issues;
      CREATE TRIGGER issue_search_vector_update
        BEFORE INSERT OR UPDATE ON issues
        FOR EACH ROW EXECUTE FUNCTION update_issue_search_vector();
    `);

    // Issue media
    await client.query(`
      CREATE TABLE IF NOT EXISTS issue_media (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        media_url TEXT NOT NULL,
        public_id TEXT,
        media_type media_type NOT NULL DEFAULT 'image',
        uploaded_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Issue status history
    await client.query(`
      CREATE TABLE IF NOT EXISTS issue_status_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        old_status issue_status,
        new_status issue_status NOT NULL,
        updated_by UUID REFERENCES users(id),
        comment TEXT,
        is_public BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Comments
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_admin_comment BOOLEAN DEFAULT FALSE,
        is_internal BOOLEAN DEFAULT FALSE,
        parent_id UUID REFERENCES comments(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Votes
    await client.query(`
      CREATE TABLE IF NOT EXISTS votes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vote_type vote_type NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(issue_id, user_id)
      );
    `);

    // Follows
    await client.query(`
      CREATE TABLE IF NOT EXISTS follows (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(issue_id, user_id)
      );
    `);

    // Notifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed default categories
    await client.query(`
      INSERT INTO categories (name, slug, icon, description) VALUES
        ('Roads & Infrastructure', 'roads-infrastructure', '🛣️', 'Potholes, road damage, bridge issues'),
        ('Water & Sanitation', 'water-sanitation', '💧', 'Water supply, drainage, sewage'),
        ('Electricity', 'electricity', '⚡', 'Power outages, street lights, electrical hazards'),
        ('Public Safety', 'public-safety', '🛡️', 'Crime, unsafe areas, emergency response'),
        ('Waste Management', 'waste-management', '♻️', 'Garbage collection, illegal dumping'),
        ('Parks & Recreation', 'parks-recreation', '🌳', 'Park maintenance, public spaces'),
        ('Public Transport', 'public-transport', '🚌', 'Bus stops, routes, transport facilities'),
        ('Environment', 'environment', '🌿', 'Pollution, deforestation, environmental hazards'),
        ('Buildings & Zoning', 'buildings-zoning', '🏗️', 'Illegal construction, building permits'),
        ('Other', 'other', '📋', 'Other civic issues')
      ON CONFLICT (slug) DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('✅ Migrations completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

migrate();
