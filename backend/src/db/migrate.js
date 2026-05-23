const pool = require('./pool');
require('dotenv').config();

const migrate = async () => {
  const client = await pool.connect();
  try {
    console.log('🚀 Running migrations...');
    await client.query('BEGIN');

    // Extensions (uuid-ossp is enough; PostGIS is optional)
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    // Ensure older tables get the uuid default
    const tables = ['users', 'refresh_tokens', 'categories', 'subcategories', 'issues', 'issue_media', 'issue_status_history', 'comments', 'votes', 'follows', 'notifications'];
    for (const table of tables) {
      await client.query(`
        DO $$ BEGIN
          ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT uuid_generate_v4();
        EXCEPTION WHEN undefined_table THEN null; END $$;
      `);
    }

    // ── ENUM types ──────────────────────────────────────────────────────────
    const enums = [
      `DO $$ BEGIN CREATE TYPE user_role AS ENUM ('citizen','admin','department_staff'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
      `DO $$ BEGIN CREATE TYPE issue_status AS ENUM ('reported','acknowledged','in_progress','resolved','rejected'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
      `DO $$ BEGIN CREATE TYPE severity_level AS ENUM ('low','medium','high','critical'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
      `DO $$ BEGIN CREATE TYPE vote_type AS ENUM ('upvote','downvote'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
      `DO $$ BEGIN CREATE TYPE media_type AS ENUM ('image','video'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    ];
    for (const sql of enums) await client.query(sql);

    // ── Users ───────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name        VARCHAR(255) NOT NULL,
        email       VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role        user_role NOT NULL DEFAULT 'citizen',
        trust_score INTEGER DEFAULT 0,
        avatar_url  TEXT,
        is_verified BOOLEAN DEFAULT FALSE,
        is_active   BOOLEAN DEFAULT TRUE,
        otp_code     VARCHAR(6),
        otp_expires_at TIMESTAMPTZ,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Refresh tokens ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token      TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Categories ──────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name        VARCHAR(100) NOT NULL UNIQUE,
        slug        VARCHAR(100) NOT NULL UNIQUE,
        icon        VARCHAR(50),
        description TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Sub-categories ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS subcategories (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        name        VARCHAR(100) NOT NULL,
        slug        VARCHAR(100) NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Issues ──────────────────────────────────────────────────────────────
    // Using plain NUMERIC columns for lat/lng — no PostGIS required.
    await client.query(`
      CREATE TABLE IF NOT EXISTS issues (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title            VARCHAR(255) NOT NULL,
        description      TEXT NOT NULL,
        category_id      UUID REFERENCES categories(id),
        subcategory_id   UUID REFERENCES subcategories(id),
        severity         severity_level NOT NULL DEFAULT 'medium',
        status           issue_status NOT NULL DEFAULT 'reported',
        latitude         NUMERIC(10,7),
        longitude        NUMERIC(10,7),
        address          TEXT,
        is_anonymous     BOOLEAN DEFAULT FALSE,
        upvote_count     INTEGER DEFAULT 0,
        downvote_count   INTEGER DEFAULT 0,
        follow_count     INTEGER DEFAULT 0,
        comment_count    INTEGER DEFAULT 0,
        assigned_to      UUID REFERENCES users(id),
        department       VARCHAR(255),
        sla_hours        INTEGER,
        sla_deadline     TIMESTAMPTZ,
        rejection_reason TEXT,
        search_vector    TSVECTOR,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW(),
        resolved_at      TIMESTAMPTZ
      );
    `);

    // Add columns if upgrading from old schema
    await client.query(`
      ALTER TABLE issues ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7);
      ALTER TABLE issues ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);
      ALTER TABLE issues ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE issues ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;
      ALTER TABLE issues ADD COLUMN IF NOT EXISTS upvote_count INTEGER DEFAULT 0;
      ALTER TABLE issues ADD COLUMN IF NOT EXISTS downvote_count INTEGER DEFAULT 0;
      ALTER TABLE issues ADD COLUMN IF NOT EXISTS follow_count INTEGER DEFAULT 0;
      ALTER TABLE issues ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;
      ALTER TABLE issues ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id);
      ALTER TABLE issues ADD COLUMN IF NOT EXISTS department VARCHAR(255);
      ALTER TABLE issues ADD COLUMN IF NOT EXISTS sla_hours INTEGER;
      ALTER TABLE issues ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ;
      ALTER TABLE issues ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
      ALTER TABLE issues ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;
      ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
    `);

    // Add columns to users if upgrading
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ;
    `);

    // Standardize column name in issue_media for old databases
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE issue_media RENAME COLUMN "mediaType" TO media_type;
      EXCEPTION WHEN others THEN null; END $$;
      ALTER TABLE issue_media ADD COLUMN IF NOT EXISTS is_resolution BOOLEAN NOT NULL DEFAULT false;
    `);

    // ── Indexes ─────────────────────────────────────────────────────────────
    await client.query(`CREATE INDEX IF NOT EXISTS issues_status_idx   ON issues (status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS issues_severity_idx ON issues (severity);`);
    await client.query(`CREATE INDEX IF NOT EXISTS issues_user_idx     ON issues (user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS issues_category_idx ON issues (category_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS issues_created_idx  ON issues (created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS issues_search_idx   ON issues USING GIN (search_vector);`);

    // ── Full-text search trigger ─────────────────────────────────────────────
    await client.query(`
      CREATE OR REPLACE FUNCTION update_issue_search_vector()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.search_vector :=
          to_tsvector('english',
            COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.description, '')
          );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`DROP TRIGGER IF EXISTS issue_search_vector_update ON issues;`);
    await client.query(`
      CREATE TRIGGER issue_search_vector_update
        BEFORE INSERT OR UPDATE ON issues
        FOR EACH ROW EXECUTE FUNCTION update_issue_search_vector();
    `);

    // ── Issue media ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS issue_media (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        issue_id      UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        media_url     TEXT NOT NULL,
        public_id     TEXT,
        media_type    media_type NOT NULL DEFAULT 'image',
        is_resolution BOOLEAN NOT NULL DEFAULT false,
        uploaded_at   TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Issue status history ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS issue_status_history (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        issue_id   UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        old_status issue_status,
        new_status issue_status NOT NULL,
        updated_by UUID REFERENCES users(id),
        comment    TEXT,
        is_public  BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Comments ────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        issue_id         UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content          TEXT NOT NULL,
        is_admin_comment BOOLEAN DEFAULT FALSE,
        is_internal      BOOLEAN DEFAULT FALSE,
        parent_id        UUID REFERENCES comments(id),
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Votes ───────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS votes (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        issue_id   UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vote_type  vote_type NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(issue_id, user_id)
      );
    `);

    // ── Follows ─────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS follows (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        issue_id   UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(issue_id, user_id)
      );
    `);

    // ── Notifications ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        issue_id   UUID REFERENCES issues(id) ON DELETE CASCADE,
        type       VARCHAR(50) NOT NULL,
        message    TEXT NOT NULL,
        is_read    BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Seed categories ──────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO categories (name, slug, icon, description) VALUES
        ('Roads & Infrastructure', 'roads-infrastructure', '🛣️', 'Potholes, road damage, bridge issues'),
        ('Water & Sanitation',     'water-sanitation',     '💧', 'Water supply, drainage, sewage'),
        ('Electricity',            'electricity',           '⚡', 'Power outages, street lights, electrical hazards'),
        ('Public Safety',          'public-safety',         '🛡️', 'Crime, unsafe areas, emergency response'),
        ('Waste Management',       'waste-management',      '♻️', 'Garbage collection, illegal dumping'),
        ('Parks & Recreation',     'parks-recreation',      '🌳', 'Park maintenance, public spaces'),
        ('Public Transport',       'public-transport',      '🚌', 'Bus stops, routes, transport facilities'),
        ('Environment',            'environment',           '🌿', 'Pollution, deforestation, environmental hazards'),
        ('Buildings & Zoning',     'buildings-zoning',      '🏗️', 'Illegal construction, building permits'),
        ('Other',                  'other',                 '📋', 'Other civic issues')
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
