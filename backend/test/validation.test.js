const test = require('node:test');
const assert = require('node:assert');
const { normalizeQuery, uuidParam, loginSchema, reviewSchema, updateProfileSchema, createIssueSchema } = require('../src/middleware/validate');

const run = (middleware, req, ...extra) => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let nextCalled = false;
  middleware(req, res, () => { nextCalled = true; }, ...extra);
  return { res, nextCalled };
};

test('normalizeQuery clamps paging values instead of failing', () => {
  const req = { query: { page: 'abc', limit: '100000' } };
  const { nextCalled } = run(normalizeQuery, req);
  assert.ok(nextCalled);
  assert.deepStrictEqual(req.query, { page: 1, limit: 100 });
});

test('normalizeQuery rejects unknown filter values with 400', () => {
  for (const query of [{ status: 'bogus' }, { severity: 'extreme' }, { date_from: 'yesterday-ish' }]) {
    const { res, nextCalled } = run(normalizeQuery, { query });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 400);
  }
});

test('normalizeQuery accepts the unresolved shortcut', () => {
  const { nextCalled } = run(normalizeQuery, { query: { status: 'unresolved' } });
  assert.ok(nextCalled);
});

test('uuidParam answers 404 for malformed ids', () => {
  const bad = run(uuidParam, {}, 'not-a-uuid');
  assert.strictEqual(bad.res.statusCode, 404);
  const good = run(uuidParam, {}, '0ee7ab6f-3f1b-450f-97b0-069fecf5b8b4');
  assert.ok(good.nextCalled);
});

test('emails are trimmed and lowercased', () => {
  const { value } = loginSchema.validate({ email: '  Test@Example.COM ', password: 'x' });
  assert.strictEqual(value.email, 'test@example.com');
});

test('reviews need a whole-number rating from 1 to 5 and a short comment', () => {
  assert.ok(reviewSchema.validate({ rating: 3.5 }).error);
  assert.ok(reviewSchema.validate({ rating: 6 }).error);
  assert.ok(reviewSchema.validate({ rating: 4, comment: 'x'.repeat(501) }).error);
  assert.ifError(reviewSchema.validate({ rating: 4, comment: 'Fixed well' }).error);
});

test('profile names must be 2 to 100 characters', () => {
  assert.ok(updateProfileSchema.validate({ name: '' }).error);
  assert.ok(updateProfileSchema.validate({ name: 'x'.repeat(101) }).error);
  assert.ifError(updateProfileSchema.validate({ name: 'Asha Rao' }).error);
});

test('a plain location description is enough; coordinates are optional but paired', () => {
  const base = { title: 'Broken light', description: 'Light out at night', category_id: '0b6f1a3e-9c1d-4a2b-8f3e-1a2b3c4d5e6f', severity: 'low' };
  assert.ifError(createIssueSchema.validate({ ...base, address: 'Sec 12 roundabout' }).error);
  assert.ifError(createIssueSchema.validate({ ...base, address: 'Sec 12 roundabout', latitude: '', longitude: '' }).error);
  assert.ifError(createIssueSchema.validate({ ...base, address: 'Near park', latitude: '28.6', longitude: '77.2' }).error);
  assert.ok(createIssueSchema.validate({ ...base, address: 'Near park', latitude: '28.6' }).error);
  assert.ok(createIssueSchema.validate({ ...base, address: '  ' }).error);
  assert.ok(createIssueSchema.validate({ ...base, latitude: '28.6', longitude: '77.2' }).error);
});
