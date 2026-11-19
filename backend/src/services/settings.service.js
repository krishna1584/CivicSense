/**
 * Admin settings live in the database so they survive redeploys.
 * data/settings.json only provides the defaults.
 */
const pool = require('../db/pool');
const DEFAULT_SETTINGS = require('../data/settings.json');

let tableReady = null;
const ensureTable = () => {
  if (!tableReady) {
    tableReady = pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key        TEXT PRIMARY KEY,
        value      JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
};

async function getSettings() {
  await ensureTable();
  const result = await pool.query(`SELECT value FROM app_settings WHERE key = 'global'`);
  return { ...DEFAULT_SETTINGS, ...(result.rows[0]?.value || {}) };
}

async function updateSettings(changes) {
  const current = await getSettings();
  const updated = { ...current };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (changes[key] !== undefined) updated[key] = changes[key];
  }
  await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ('global', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(updated)]
  );
  return updated;
}

module.exports = { getSettings, updateSettings };
