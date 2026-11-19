const rateLimit = require('express-rate-limit');

const createLimiter = (windowMs, max, message) =>
  rateLimit({ windowMs, max, message: { error: message }, standardHeaders: true, legacyHeaders: false });

const authLimiter = createLimiter(15 * 60 * 1000, 10, 'Too many auth attempts, try again in 15 minutes');
const apiLimiter = createLimiter(60 * 1000, 100, 'Too many requests, slow down');
const uploadLimiter = createLimiter(60 * 60 * 1000, 20, 'Upload limit reached, try again in an hour');

// Counters live only in memory and expire with their window; IPs are never written to the database.
const anonymousReportLimiter = createLimiter(60 * 60 * 1000, 5, 'Report limit reached, try again in an hour');
const anonymousLookupLimiter = createLimiter(15 * 60 * 1000, 30, 'Too many attempts, try again in 15 minutes');

module.exports = { authLimiter, apiLimiter, uploadLimiter, anonymousReportLimiter, anonymousLookupLimiter };
