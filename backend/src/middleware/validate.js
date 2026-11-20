const Joi = require('joi');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISSUE_STATUSES = ['reported', 'acknowledged', 'in_progress', 'pending_verification', 'resolved', 'rejected'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const notFound = (res) => res.status(404).json({ error: 'Not found' });

/** For router.param: a malformed id can't match any record, so answer 404 before touching the database. */
const uuidParam = (req, res, next, value) => (UUID_RE.test(value) ? next() : notFound(res));

/** For routers mounted under a parent path such as /issues/:issueId (router.param doesn't see those). */
const requireUuidParams = (...names) => (req, res, next) =>
  names.every((name) => UUID_RE.test(req.params[name] || '')) ? next() : notFound(res);

const clampInt = (value, fallback, min, max) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
};

/** Normalise the query parameters every list endpoint shares, rejecting unknown filter values. */
const normalizeQuery = (req, res, next) => {
  const q = req.query;
  if (q.page !== undefined) q.page = clampInt(q.page, 1, 1, 100000);
  if (q.limit !== undefined) q.limit = clampInt(q.limit, 20, 1, 100);
  if (q.status !== undefined && ![...ISSUE_STATUSES, 'unresolved'].includes(q.status)) {
    return res.status(400).json({ error: 'Invalid status filter' });
  }
  if (q.severity !== undefined && !SEVERITIES.includes(q.severity)) {
    return res.status(400).json({ error: 'Invalid severity filter' });
  }
  for (const key of ['date_from', 'date_to']) {
    if (q[key] !== undefined && (typeof q[key] !== 'string' || Number.isNaN(Date.parse(q[key])))) {
      return res.status(400).json({ error: `Invalid ${key}` });
    }
  }
  next();
};

// Emails are compared case-insensitively everywhere
const email = () => Joi.string().trim().lowercase().email();

const validate = (schema, property = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[property], { abortEarly: false, stripUnknown: true });
  if (error) {
    const errors = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
    return res.status(422).json({ error: 'Validation failed', errors });
  }
  req[property] = value;
  next();
};

// Auth schemas
const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: email().required(),
  password: Joi.string().min(8).max(128).required(),
});

const loginSchema = Joi.object({
  email: email().required(),
  password: Joi.string().max(128).required(),
});

const sendOtpSchema = Joi.object({
  email: email().required(),
});

const verifyOtpSchema = Joi.object({
  email: email().required(),
  code: Joi.string().pattern(/^\d{6}$/).required(),
});

const resetPasswordSchema = Joi.object({
  email: email().required(),
  code: Joi.string().pattern(/^\d{6}$/).required(),
  password: Joi.string().min(8).max(128).required(),
});

// Issue schemas
// NOTE: FormData sends everything as strings, so we enable convert:true (default)
// and handle is_anonymous as string 'true'/'false' OR boolean
const createIssueSchema = Joi.object({
  title: Joi.string().min(5).max(255).required(),
  description: Joi.string().min(10).max(5000).required(),
  category_id: Joi.string().uuid().required(),
  subcategory_id: Joi.string().uuid().optional().allow(''),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  address: Joi.string().max(500).optional().allow(''),
  is_anonymous: Joi.alternatives().try(
    Joi.boolean(),
    Joi.string().valid('true', 'false').custom((v) => v === 'true')
  ).default(false),
});

const anonymousReportSchema = createIssueSchema.keys({
  is_anonymous: Joi.any().strip(),
  challenge: Joi.string().max(200).required(),
  solution: Joi.string().max(32).required(),
});

// base64url encoding of a 32-byte random value
const trackingToken = Joi.string().pattern(/^[A-Za-z0-9_-]{43}$/).required();

const anonymousTrackSchema = Joi.object({ token: trackingToken });

const anonymousDecisionSchema = Joi.object({
  token: trackingToken,
  approved: Joi.boolean().required(),
  comment: Joi.string().trim().max(1000).when('approved', { is: false, then: Joi.required() }),
});

const updateIssueStatusSchema = Joi.object({
  status: Joi.string().valid('reported', 'acknowledged', 'in_progress', 'pending_verification', 'resolved', 'rejected').required(),
  comment: Joi.string().max(1000).optional(),
  rejection_reason: Joi.string().max(500).when('status', { is: 'rejected', then: Joi.required() }),
});

// Comment schemas
const createCommentSchema = Joi.object({
  content: Joi.string().min(1).max(2000).required(),
  parent_id: Joi.string().uuid().optional(),
  is_internal: Joi.boolean().default(false),
});

const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  address: Joi.string().trim().max(500).allow(''),
});

const reviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().max(500).allow(''),
});

const updateCommentSchema = Joi.object({
  content: Joi.string().trim().min(1).max(2000).required(),
});

module.exports = {
  validate,
  UUID_RE,
  uuidParam,
  requireUuidParams,
  normalizeQuery,
  updateProfileSchema,
  reviewSchema,
  anonymousReportSchema,
  anonymousTrackSchema,
  anonymousDecisionSchema,
  resetPasswordSchema,
  updateCommentSchema,
  registerSchema,
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
  createIssueSchema,
  updateIssueStatusSchema,
  createCommentSchema,
};
