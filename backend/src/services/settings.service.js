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

/** Keep only known settings and check each has the right type and range. Throws a 400 error otherwise. */
function sanitizeSettingsChanges(changes = {}) {
  const clean = {};
  const fail = (message) => Object.assign(new Error(message), { status: 400 });
  for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
    const value = changes[key];
    if (value === undefined) continue;
    if (typeof value !== typeof defaultValue) throw fail(`${key} must be a ${typeof defaultValue}`);
    if (typeof value === 'string' && value.length > 500) throw fail(`${key} is too long`);
    clean[key] = value;
  }
  if (clean.minUpvotesForAutoAcknowledge !== undefined &&
      (!Number.isInteger(clean.minUpvotesForAutoAcknowledge) || clean.minUpvotesForAutoAcknowledge < 1 || clean.minUpvotesForAutoAcknowledge > 1000)) {
    throw fail('minUpvotesForAutoAcknowledge must be a whole number from 1 to 1000');
  }
  if (clean.alertBannerType !== undefined && !['info', 'warning', 'critical'].includes(clean.alertBannerType)) {
    throw fail('alertBannerType must be info, warning or critical');
  }
  return clean;
}

async function updateSettings(changes) {
  const current = await getSettings();
  const updated = { ...current, ...sanitizeSettingsChanges(changes) };
  await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ('global', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(updated)]
  );
  return updated;
}

module.exports = { getSettings, updateSettings, sanitizeSettingsChanges };
