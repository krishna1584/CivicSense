process.env.JWT_SECRET = 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const { presentIssue } = require('../src/services/issues.service');
const { hashOtp, otpMatches, generateOtp } = require('../src/services/otp.service');
const { escapeHtml } = require('../src/services/mail');
const { sanitizeSettingsChanges } = require('../src/services/settings.service');

const anonymousIssue = { id: 'i1', user_id: 'u1', is_anonymous: true, reporter_name: 'Asha', reporter_avatar: 'a.png', reporter_trust: 60 };

test('anonymous issues hide the reporter from other viewers', () => {
  for (const viewer of [undefined, 'someone-else']) {
    const shown = presentIssue(anonymousIssue, viewer);
    assert.strictEqual(shown.user_id, null);
    assert.strictEqual(shown.reporter_name, null);
    assert.strictEqual(shown.reporter_avatar, null);
    assert.strictEqual(shown.is_owner, false);
  }
});

test('the reporter still recognises their own anonymous issue', () => {
  const shown = presentIssue(anonymousIssue, 'u1');
  assert.strictEqual(shown.is_owner, true);
});

test('OTP codes are six digits and stored only as a keyed hash', () => {
  const otp = generateOtp();
  assert.match(otp, /^\d{6}$/);
  const stored = hashOtp(otp);
  assert.notStrictEqual(stored, otp);
  assert.strictEqual(stored.length, 64);
  assert.ok(otpMatches(otp, stored));
  assert.ok(!otpMatches('000000' === otp ? '111111' : '000000', stored));
  assert.ok(!otpMatches(otp, null));
});

test('user text is escaped before going into email HTML', () => {
  assert.strictEqual(escapeHtml('<b>Hi</b> & "you"'), '&lt;b&gt;Hi&lt;/b&gt; &amp; &quot;you&quot;');
  assert.strictEqual(escapeHtml(undefined), '');
});

test('admin settings keep only known keys with the right types', () => {
  assert.deepStrictEqual(sanitizeSettingsChanges({ enableRegistration: false, hacker: 'x' }), { enableRegistration: false });
  assert.throws(() => sanitizeSettingsChanges({ enableRegistration: 'no' }), { status: 400 });
  assert.throws(() => sanitizeSettingsChanges({ minUpvotesForAutoAcknowledge: 0 }), { status: 400 });
  assert.throws(() => sanitizeSettingsChanges({ alertBannerType: 'purple' }), { status: 400 });
});
