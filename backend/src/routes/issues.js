const express = require('express');
const pool = require('../db/pool');
const { auth, requireRole, requireVerified, optionalAuth } = require('../middleware/auth');
const { validate, uuidParam, createIssueSchema, updateIssueStatusSchema } = require('../middleware/validate');
const { upload, storeUploads } = require('../middleware/upload');
const { apiLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const issuesService = require('../services/issues.service');
const { getSettings } = require('../services/settings.service');

const router = express.Router();
router.param('id', uuidParam);

// GET /api/issues - list with filter, sort, search, pagination
router.get('/', optionalAuth, async (req, res) => {
  const {
    page = 1, limit = 12, category, status, severity,
    sort = 'newest', search, lat, lng, radius = 10000,
    date_from, date_to
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const values = [];
  const conditions = [issuesService.PUBLIC_ISSUE_SQL];
  let idx = 1;

  if (category) { conditions.push(`c.slug = $${idx++}`); values.push(category); }
  if (status === 'unresolved') {
    conditions.push(`i.status NOT IN ('resolved', 'rejected')`);
  } else if (status) {
    conditions.push(`i.status = $${idx++}`);
    values.push(status);
  }
  if (severity) { conditions.push(`i.severity = $${idx++}`); values.push(severity); }
  if (date_from) { conditions.push(`i.created_at >= $${idx++}`); values.push(date_from); }
  if (date_to) { conditions.push(`i.created_at <= $${idx++}`); values.push(date_to); }
  if (search) {
    conditions.push(`(i.search_vector @@ plainto_tsquery('english', $${idx}) OR i.id::text ILIKE $${idx + 1})`);
    values.push(search, `%${search}%`);
    idx += 2;
  }
  if (lat && lng) {
    conditions.push(`(sqrt(power(i.latitude - $${idx++}, 2) + power(i.longitude - $${idx++}, 2)) * 111139) <= $${idx++}`);
    values.push(parseFloat(lat), parseFloat(lng), parseFloat(radius));
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const distanceSelect = lat && lng
    ? `, (sqrt(power(i.latitude - ${parseFloat(lat)}, 2) + power(i.longitude - ${parseFloat(lng)}, 2)) * 111139) AS distance`
    : '';

  const orderMap = {
    newest: 'i.created_at DESC',
    oldest: 'i.created_at ASC',
    upvotes: 'i.upvote_count DESC',
    comments: 'i.comment_count DESC',
    proximity: lat && lng ? `sqrt(power(i.latitude - ${parseFloat(lat)}, 2) + power(i.longitude - ${parseFloat(lng)}, 2))` : 'i.created_at DESC',
    status: 'i.status ASC',
  };
  const orderBy = orderMap[sort] || 'i.created_at DESC';

  try {
    values.push(parseInt(limit), offset);
    const query = `
      SELECT i.*, u.name AS reporter_name, u.avatar_url AS reporter_avatar,
             c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
             ARRAY(SELECT json_build_object('id', m.id, 'url', m.media_url, 'type', m.media_type, 'is_resolution', m.is_resolution)
                   FROM issue_media m WHERE m.issue_id = i.id ORDER BY m.uploaded_at ASC) AS media
             ${distanceSelect}
      FROM issues i
      LEFT JOIN users u ON i.user_id = u.id
      LEFT JOIN categories c ON i.category_id = c.id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const countQuery = `
      SELECT COUNT(*) FROM issues i
      LEFT JOIN categories c ON i.category_id = c.id
      ${where}
    `;

    const [issuesResult, countResult] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, values.slice(0, values.length - 2)),
    ]);

    res.json({
      issues: issuesResult.rows.map((issue) => issuesService.presentIssue(issue, req.user?.id)),
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

// GET /api/issues/stats/public  ← real numbers for the landing page
router.get('/stats/public', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
             ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
                   FILTER (WHERE status = 'resolved' AND resolved_at IS NOT NULL), 1) AS avg_resolution_hours,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS last_30_days
      FROM issues i
      WHERE ${issuesService.PUBLIC_ISSUE_SQL}
    `);
    const row = result.rows[0];
    const total = parseInt(row.total, 10);
    const resolved = parseInt(row.resolved, 10);
    res.json({
      total,
      resolved,
      resolutionRate: total ? Math.round((resolved / total) * 100) : null,
      avgResolutionHours: row.avg_resolution_hours === null ? null : parseFloat(row.avg_resolution_hours),
      last30Days: parseInt(row.last_30_days, 10),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load statistics' });
  }
});

// GET /api/issues/categories/all  ← must come BEFORE /:id
router.get('/categories/all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    res.json({ categories: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/issues/trending/nearby  ← must come BEFORE /:id
router.get('/trending/nearby', optionalAuth, async (req, res) => {
  const { lat, lng, radius = 5000 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
  try {
    const result = await pool.query(`
      SELECT i.*, c.name AS category_name, c.icon AS category_icon,
             (i.upvote_count + i.follow_count * 2 + i.comment_count) AS impact_score,
             (sqrt(power(i.latitude - $2, 2) + power(i.longitude - $1, 2)) * 111139) AS distance
      FROM issues i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE (sqrt(power(i.latitude - $2, 2) + power(i.longitude - $1, 2)) * 111139) <= $3
        AND ${issuesService.PUBLIC_ISSUE_SQL}
        AND i.status NOT IN ('resolved', 'rejected')
        AND i.created_at > NOW() - INTERVAL '7 days'
      ORDER BY impact_score DESC
      LIMIT 10
    `, [parseFloat(lng), parseFloat(lat), parseFloat(radius)]);
    res.json({ trending: result.rows.map((issue) => issuesService.presentIssue(issue, req.user?.id)) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trending issues' });
  }
});

// GET /api/issues/:id
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, u.name AS reporter_name, u.avatar_url AS reporter_avatar, u.trust_score AS reporter_trust,
             c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
             sc.name AS subcategory_name,
             ${issuesService.PUBLIC_ISSUE_SQL} AS is_public,
             i.longitude AS longitude,
             i.latitude AS latitude,
             ARRAY(SELECT json_build_object('id', m.id, 'url', m.media_url, 'type', m.media_type, 'is_resolution', m.is_resolution)
                   FROM issue_media m WHERE m.issue_id = i.id) AS media
      FROM issues i
      LEFT JOIN users u ON i.user_id = u.id
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN subcategories sc ON i.subcategory_id = sc.id
      WHERE i.id = $1
    `, [req.params.id]);

    const isStaff = ['admin', 'department_staff'].includes(req.user?.role);
    if (!result.rows[0] || (!result.rows[0].is_public && !isStaff)) return res.status(404).json({ error: 'Issue not found' });

    // Check if current user voted/followed
    let userInteraction = null;
    if (req.user) {
      const [vote, follow] = await Promise.all([
        pool.query('SELECT vote_type FROM votes WHERE issue_id = $1 AND user_id = $2', [req.params.id, req.user.id]),
        pool.query('SELECT id FROM follows WHERE issue_id = $1 AND user_id = $2', [req.params.id, req.user.id]),
      ]);
      userInteraction = { voted: vote.rows[0]?.vote_type || null, following: !!follow.rows[0] };
    }

    res.json({ issue: issuesService.presentIssue(result.rows[0], req.user?.id), userInteraction });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch issue' });
  }
});

// POST /api/issues - create issue
router.post('/', auth, requireVerified, uploadLimiter, upload.array('media', 5), validate(createIssueSchema), async (req, res) => {
  const { title, description, category_id, subcategory_id, severity, latitude, longitude, address, is_anonymous } = req.body;

  if (!req.files?.length) {
    return res.status(422).json({ error: 'At least one photo or video is required.' });
  }

  let storedMedia;
  try {
    if (is_anonymous) {
      const { enableAnonymousReporting } = await getSettings();
      if (!enableAnonymousReporting) return res.status(403).json({ error: 'Anonymous reporting is currently disabled.' });
    }
    storedMedia = await storeUploads(req.files, req, { folder: 'civicsense/issues', prefix: 'issue' });
  } catch (err) {
    console.error('Issue media upload failed:', err);
    return res.status(502).json({ error: 'Could not upload your files. Please try again.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const issue = await issuesService.insertReport(client, {
      userId: req.user.id,
      fields: { title, description, category_id, subcategory_id, severity, latitude, longitude, address },
      isAnonymous: is_anonymous,
      media: storedMedia,
      holdForReview: false,
      historyComment: 'Issue reported',
    });

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) io.emit('new_issue', { issue: issuesService.presentIssue(issue) });

    res.status(201).json({ issue });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create issue' });
  } finally {
    client.release();
  }
});

// PATCH /api/issues/:id/status - admin/staff only
router.patch('/:id/status', auth, requireRole('admin', 'department_staff'), upload.array('media', 5), validate(updateIssueStatusSchema), async (req, res) => {
  const { status, comment, rejection_reason } = req.body;

  let proofMedia = [];
  if (status === 'resolved' && req.files?.length) {
    try {
      proofMedia = await storeUploads(req.files, req, { folder: 'civicsense/issues', prefix: 'resolution' });
    } catch (err) {
      console.error('Resolution media upload failed:', err);
      return res.status(502).json({ error: 'Could not upload the proof files. Please try again.' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const issueRes = await client.query('SELECT * FROM issues WHERE id = $1', [req.params.id]);
    if (!issueRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Issue not found' });
    }
    const issue = issueRes.rows[0];

    let finalStatus = status;
    const isResolving = status === 'resolved';

    if (isResolving) {
      // Force database status to pending_verification for citizen review
      finalStatus = 'pending_verification';
    }

    const resolvedAt = finalStatus === 'resolved' ? new Date() : undefined;
    const updates = ['status = $1', 'updated_at = NOW()'];
    const values = [finalStatus];
    let idx = 2;

    if (rejection_reason) { updates.push(`rejection_reason = $${idx++}`); values.push(rejection_reason); }
    if (resolvedAt) { updates.push(`resolved_at = $${idx++}`); values.push(resolvedAt); }
    values.push(req.params.id);

    const updatedIssue = await client.query(
      `UPDATE issues SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    for (const { mediaUrl, publicId, mediaType } of proofMedia) {
      await client.query(
        'INSERT INTO issue_media (issue_id, media_url, public_id, media_type, is_resolution) VALUES ($1, $2, $3, $4, TRUE)',
        [issue.id, mediaUrl, publicId, mediaType]
      );
    }

    const historyComment = isResolving 
      ? (comment || 'Resolution proposed by administrator. Verification image uploaded.') 
      : (comment || null);

    await client.query(
      'INSERT INTO issue_status_history (issue_id, old_status, new_status, updated_by, comment) VALUES ($1, $2, $3, $4, $5)',
      [issue.id, issue.status, finalStatus, req.user.id, historyComment]
    );

    // Notify followers
    const notifs = await issuesService.notifyFollowers(client, {
      issueId: issue.id,
      issueTitle: issue.title,
      newStatus: finalStatus,
      actorId: req.user.id
    });

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) {
      io.to(`issue_${issue.id}`).emit('issue_status_updated', { issueId: issue.id, status: finalStatus, updatedBy: req.user.name });
      for (const n of notifs) {
        io.to(`user_${n.user_id}`).emit('new_notification', n);
      }
    }

    res.json({ issue: { ...updatedIssue.rows[0], status: finalStatus } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to update status' });
  } finally {
    client.release();
  }
});

// POST /api/issues/:id/verify-resolution   (Issue Reporter Only)
router.post('/:id/verify-resolution', auth, async (req, res) => {
  const { approved, comment } = req.body;
  const { id: issueId } = req.params;

  if (typeof approved !== 'boolean') {
    return res.status(400).json({ error: 'approved boolean field is required.' });
  }
  if (comment !== undefined && (typeof comment !== 'string' || comment.length > 1000)) {
    return res.status(400).json({ error: 'comment must be text of up to 1000 characters.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const issueRes = await client.query('SELECT * FROM issues WHERE id = $1', [issueId]);
    if (!issueRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Issue not found' });
    }
    const issue = issueRes.rows[0];

    // Authorization: Only the original reporter can verify
    if (issue.user_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the original reporter can verify the resolution.' });
    }

    // Logic: Must be pending_verification
    if (issue.status !== 'pending_verification') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This issue is not awaiting resolution verification.' });
    }

    const { nextStatus, updatedIssue, notifications: notifs } = await issuesService.recordResolutionDecision(client, issue, {
      approved,
      comment,
      actorId: req.user.id,
    });

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) {
      io.to(`issue_${issue.id}`).emit('issue_status_updated', { issueId: issue.id, status: nextStatus, updatedBy: issue.is_anonymous ? 'Anonymous reporter' : req.user.name });
      for (const n of notifs) {
        io.to(`user_${n.user_id}`).emit('new_notification', n);
      }
    }

    res.json({ message: `Issue successfully transitioned to ${nextStatus}`, status: nextStatus, issue: updatedIssue });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('verifyResolution:', err);
    res.status(500).json({ error: 'Failed to process resolution verification' });
  } finally {
    client.release();
  }
});

// GET /api/issues/:id/history
router.get('/:id/history', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.id, h.issue_id, h.old_status, h.new_status, h.comment, h.is_public, h.updated_at,
             CASE WHEN i.is_anonymous AND h.updated_by = i.user_id THEN NULL ELSE h.updated_by END AS updated_by,
             CASE WHEN i.is_anonymous AND h.updated_by = i.user_id THEN 'Anonymous reporter' ELSE u.name END AS updated_by_name,
             CASE WHEN i.is_anonymous AND h.updated_by = i.user_id THEN NULL ELSE u.role END AS updated_by_role
      FROM issue_status_history h
      JOIN issues i ON h.issue_id = i.id
      LEFT JOIN users u ON h.updated_by = u.id
      WHERE h.issue_id = $1 AND h.is_public = TRUE
      ORDER BY h.updated_at ASC
    `, [req.params.id]);
    res.json({ history: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
