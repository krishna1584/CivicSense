/**
 * One-time codes for email verification and password reset.
 * Codes are random, stored only as a keyed hash, expire after 10 minutes,
 * and stop working after 5 wrong guesses.
 */
const crypto = require('crypto');

const OTP_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

// Keyed with a server secret: with only 1,000,000 possible codes, a plain hash
// in a leaked database could be reversed instantly.
const hashOtp = (otp) => crypto.createHmac('sha256', `otp:${process.env.JWT_SECRET}`).update(String(otp)).digest('hex');

const otpMatches = (otp, storedHash) => {
  if (!storedHash) return false;
  const expected = Buffer.from(storedHash);
  const received = Buffer.from(hashOtp(otp));
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};

/** Create a fresh code for a user (replacing any old one) and return it for emailing. */
async function issueOtp(db, userId) {
  const otp = generateOtp();
  await db.query(
    'UPDATE users SET otp_code = $1, otp_expires_at = NOW() + make_interval(mins => $2), otp_attempts = 0 WHERE id = $3',
    [hashOtp(otp), OTP_TTL_MINUTES, userId]
  );
  return otp;
}

/** Check a code for a user row with id, otp_code and otp_expires_at. Wrong guesses are counted. */
async function checkOtp(db, user, code) {
  if (!user?.otp_code || !user.otp_expires_at || new Date() > new Date(user.otp_expires_at)) return false;
  if (otpMatches(code, user.otp_code)) return true;
  await db.query(
    `UPDATE users SET otp_attempts = otp_attempts + 1,
       otp_code = CASE WHEN otp_attempts + 1 >= $2 THEN NULL ELSE otp_code END
     WHERE id = $1`,
    [user.id, MAX_OTP_ATTEMPTS]
  );
  return false;
}

module.exports = { OTP_TTL_MINUTES, MAX_OTP_ATTEMPTS, generateOtp, hashOtp, otpMatches, issueOtp, checkOtp };
