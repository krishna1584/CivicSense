/**
 * No-login reporting. These routes deliberately use no auth middleware and never
 * read cookies or store an IP: the safest identity data is the data never kept.
 * Ownership is proven by a random tracking token, of which only a hash is stored.
 */
const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const { uploadAnonymous, stripImageMetadata, storeUploads } = require('../middleware/upload');
const { anonymousReportLimiter, anonymousLookupLimiter } = require('../middleware/rateLimiter');
const { validate, anonymousReportSchema, anonymousTrackSchema, anonymousDecisionSchema } = require('../middleware/validate');
const issuesService = require('../services/issues.service');
const { getSettings } = require('../services/settings.service');
const { issueChallenge, redeemSolution } = require('../services/proofOfWork');

const router = express.Router();

// The token can't be guessed, so a fast hash is safe and allows direct lookup.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const NOT_FOUND = { error: 'No report matches this tracking code.' };

// GET /api/anonymous/challenge
router.get('/challenge', (req, res) => res.json(issueChallenge()));

// POST /api/anonymous/reports
router.post('/reports', anonymousReportLimiter, uploadAnonymous.array('media', 5), validate(anonymousReportSchema), async (req, res) => {
  const { challenge, solution, ...fields } = req.body;

  if (!req.files?.length) {
    return res.status(422).json({ error: 'At least one photo is required.' });
  }
  if (!redeemSolution(challenge, solution)) {
    return res.status(400).json({ error: 'Security check failed. Please try again.', code: 'POW_FAILED' });
  }

  let media;
  try {
    const { enableAnonymousReporting } = await getSettings();
    if (!enableAnonymousReporting) return res.status(403).json({ error: 'Anonymous reporting is currently disabled.' });

    try {
      await stripImageMetadata(req.files);
    } catch {
      return res.status(400).json({ error: 'One of the files is not a valid image.' });
    }
    media = await storeUploads(req.files, req, { folder: 'civicsense/issues', prefix: 'issue' });
  } catch (err) {
    console.error('Anonymous report upload failed:', err.message);
    return res.status(502).json({ error: 'Could not upload your photos. Please try again.' });
  }

  const trackingToken = crypto.randomBytes(32).toString('base64url');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const issue = await issuesService.insertReport(client, {
      userId: null,
      fields,
      isAnonymous: true,
      media,
      holdForReview: true,
      historyComment: 'Reported anonymously',
    });
    await client.query('INSERT INTO anonymous_report_tokens (issue_id, token_hash) VALUES ($1, $2)', [issue.id, hashToken(trackingToken)]);
    await client.query('COMMIT');
    res.status(201).json({ trackingToken });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Anonymous report failed:', err.message);
    res.status(500).json({ error: 'Failed to submit report' });
  } finally {
    client.release();
  }
});

// POST /api/anonymous/track  (POST keeps the token out of URLs and access logs)
router.post('/track', anonymousLookupLimiter, validate(anonymousTrackSchema), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.id, i.title, i.description, i.status, i.severity, i.address, i.department, i.created_at, i.updated_at,
             i.moderation_status, i.publish_after, i.rejection_reason,
             c.name AS category_name, c.icon AS category_icon,
             ${issuesService.PUBLIC_ISSUE_SQL} AS is_public,
             ARRAY(SELECT json_build_object('id', m.id, 'url', m.media_url, 'type', m.media_type, 'is_resolution', m.is_resolution)
                   FROM issue_media m WHERE m.issue_id = i.id ORDER BY m.uploaded_at ASC) AS media,
             ARRAY(SELECT json_build_object('id', h.id, 'status', h.new_status, 'comment', h.comment, 'updated_at', h.updated_at)
                   FROM issue_status_history h WHERE h.issue_id = i.id AND h.is_public = TRUE ORDER BY h.updated_at ASC) AS history
      FROM anonymous_report_tokens t
      JOIN issues i ON i.id = t.issue_id
      LEFT JOIN categories c ON c.id = i.category_id
      WHERE t.token_hash = $1
    `, [hashToken(req.body.token)]);

    if (!result.rows[0]) return res.status(404).json(NOT_FOUND);
    res.json({ issue: result.rows[0] });
  } catch (err) {
    console.error('Anonymous track failed:', err.message);
    res.status(500).json({ error: 'Failed to load report' });
  }
});

// POST /api/anonymous/decision  (token holder accepts or rejects a resolution)
router.post('/decision', anonymousLookupLimiter, validate(anonymousDecisionSchema), async (req, res) => {
  const { token, approved, comment } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(`
      SELECT i.* FROM anonymous_report_tokens t JOIN issues i ON i.id = t.issue_id
      WHERE t.token_hash = $1 FOR UPDATE OF i
    `, [hashToken(token)]);
    const issue = found.rows[0];

    if (!issue) {
      await client.query('ROLLBACK');
      return res.status(404).json(NOT_FOUND);
    }
    if (issue.status !== 'pending_verification') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This report is not awaiting your confirmation.' });
    }

    const { nextStatus, notifications } = await issuesService.recordResolutionDecision(client, issue, { approved, comment, actorId: null });
    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) {
      io.to(`issue_${issue.id}`).emit('issue_status_updated', { issueId: issue.id, status: nextStatus, updatedBy: 'Anonymous reporter' });
      for (const n of notifications) io.to(`user_${n.user_id}`).emit('new_notification', n);
    }
    res.json({ status: nextStatus });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Anonymous decision failed:', err.message);
    res.status(500).json({ error: 'Failed to save your decision' });
  } finally {
    client.release();
  }
});

module.exports = router;
