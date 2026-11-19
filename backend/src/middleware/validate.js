const Joi = require('joi');

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
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const sendOtpSchema = Joi.object({
  email: Joi.string().email().required(),
});

const verifyOtpSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).required(),
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).required(),
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

const updateCommentSchema = Joi.object({
  content: Joi.string().trim().min(1).max(2000).required(),
});

module.exports = {
  validate,
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
