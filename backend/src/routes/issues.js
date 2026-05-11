/**
 * issues.js  (routes)
 * Thin route definitions only — all logic lives in the controller.
 */
const express = require('express');
const { auth, requireRole, optionalAuth } = require('../middleware/auth');
const { validate, createIssueSchema, updateIssueStatusSchema } = require('../middleware/validate');
const { upload } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
const ctrl = require('../controllers/issues.controller');

const router = express.Router();

// ── Categories ────────────────────────────────────────────────────────────────
// Must be declared BEFORE /:id to avoid route collision
router.get('/categories/all', ctrl.getCategories);

// ── Issues list ───────────────────────────────────────────────────────────────
router.get('/', optionalAuth, ctrl.listIssues);

// ── Create issue ──────────────────────────────────────────────────────────────
router.post(
  '/',
  auth,
  uploadLimiter,
  upload.array('media', 5),
  validate(createIssueSchema),
  ctrl.createIssue
);

// ── Single issue ──────────────────────────────────────────────────────────────
router.get('/:id', optionalAuth, ctrl.getIssue);

// ── Status update (admin / staff only) ───────────────────────────────────────
router.patch(
  '/:id/status',
  auth,
  requireRole('admin', 'department_staff'),
  validate(updateIssueStatusSchema),
  ctrl.updateIssueStatus
);

// ── Status history ────────────────────────────────────────────────────────────
router.get('/:id/history', optionalAuth, ctrl.getIssueHistory);

module.exports = router;
