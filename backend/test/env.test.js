const test = require('node:test');
const assert = require('node:assert');
const { checkEnv } = require('../src/config/env');

const base = () => ({ DATABASE_URL: 'postgres://x', JWT_SECRET: 'a'.repeat(40), JWT_REFRESH_SECRET: 'b'.repeat(40) });

test('a minimal development setup passes', () => {
  assert.deepStrictEqual(checkEnv(base()), { errors: [], warnings: [] });
});

test('missing required settings are errors', () => {
  const { errors } = checkEnv({});
  assert.deepStrictEqual(errors, ['DATABASE_URL is required', 'JWT_SECRET is required', 'JWT_REFRESH_SECRET is required']);
});

test('production needs the frontend address and warns about optional services', () => {
  const { errors, warnings } = checkEnv({ ...base(), NODE_ENV: 'production' });
  assert.ok(errors.some((e) => e.startsWith('FRONTEND_URL')));
  assert.ok(warnings.some((w) => w.startsWith('SMTP is not configured')));
  assert.ok(warnings.some((w) => w.startsWith('Cloudinary')));
});

test('older variable names still work', () => {
  const env = { ...base(), NODE_ENV: 'production', CLIENT_URL: 'https://app.example.com', SMTP_FROM: 'a@example.com' };
  const { errors } = checkEnv(env);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(env.FRONTEND_URL, 'https://app.example.com');
  assert.strictEqual(env.EMAIL_FROM, 'a@example.com');
});

test('weak or reused secrets produce warnings, not a crash', () => {
  const { errors, warnings } = checkEnv({ ...base(), NODE_ENV: 'production', FRONTEND_URL: 'https://x', JWT_SECRET: 'short', JWT_REFRESH_SECRET: 'short' });
  assert.deepStrictEqual(errors, []);
  assert.ok(warnings.some((w) => w.includes('different')));
  assert.ok(warnings.some((w) => w.includes('32 characters')));
});
