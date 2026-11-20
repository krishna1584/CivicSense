const rateLimit = require('express-rate-limit');

// Counters live only in memory and expire with their window; nothing is written to the database.
const createLimiter = (windowMs, max, message, keyGenerator) =>
  rateLimit({ windowMs, max, message: { error: message }, standardHeaders: true, legacyHeaders: false, ...(keyGenerator && { keyGenerator }) });

// Keying on IP + email means one busy network (an office, a mobile carrier) doesn't
// lock everyone out, while one address still only gets a few guesses.
const byIpAndEmail = (req) => `${req.ip}:${String(req.body?.email || '').trim().toLowerCase()}`;

const MINUTE = 60 * 1000;

const loginIpLimiter = createLimiter(15 * MINUTE, 50, 'Too many sign-in attempts from this network, try again in 15 minutes');
const loginLimiter = createLimiter(15 * MINUTE, 10, 'Too many sign-in attempts, try again in 15 minutes', byIpAndEmail);
const registerLimiter = createLimiter(60 * MINUTE, 10, 'Too many sign-ups from this network, try again in an hour');
const otpSendLimiter = createLimiter(15 * MINUTE, 5, 'Too many code requests, try again in 15 minutes', byIpAndEmail);
const otpVerifyLimiter = createLimiter(15 * MINUTE, 15, 'Too many attempts, try again in 15 minutes', byIpAndEmail);

const apiLimiter = createLimiter(MINUTE, 100, 'Too many requests, slow down');
const uploadLimiter = createLimiter(60 * MINUTE, 20, 'Upload limit reached, try again in an hour');
const anonymousReportLimiter = createLimiter(60 * MINUTE, 5, 'Report limit reached, try again in an hour');
const anonymousLookupLimiter = createLimiter(15 * MINUTE, 30, 'Too many attempts, try again in 15 minutes');

module.exports = {
  loginIpLimiter,
  loginLimiter,
  registerLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  apiLimiter,
  uploadLimiter,
  anonymousReportLimiter,
  anonymousLookupLimiter,
};
