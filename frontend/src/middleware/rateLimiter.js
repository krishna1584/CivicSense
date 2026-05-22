const rateLimit = require('express-rate-limit');

const createLimiter = (windowMs, max, message) =>
  rateLimit({ windowMs, max, message: { error: message }, standardHeaders: true, legacyHeaders: false });

const authLimiter = createLimiter(15 * 60 * 1000, 10, 'Too many auth attempts, try again in 15 minutes');
const apiLimiter = createLimiter(60 * 1000, 100, 'Too many requests, slow down');
const uploadLimiter = createLimiter(60 * 60 * 1000, 20, 'Upload limit reached, try again in an hour');

module.exports = { authLimiter, apiLimiter, uploadLimiter };
