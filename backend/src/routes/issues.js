const express = require('express');
const pool = require('../db/pool');
const { auth, requireRole, optionalAuth } = require('../middleware/auth');
const { validate, createIssueSchema, updateIssueStatusSchema } = require('../middleware/validate');
const { upload, uploadToCloudinary } = require('../middleware/upload');
const { apiLimiter, uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// GET /api/issues - list with filter, sort, search, pagination
router.get('/', optionalAuth, async (req, res) => {
  const {
    page = 1, limit = 12, category, status, severity,
    sort = 'newest', search, lat, lng, radius = 10000,
    date_from, date_to
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const values = [];
  const conditions = [];
  let idx = 1;

  if (category) { conditions.push(`c.slug = $${idx++}`); values.push(category); }
  if (status) { conditions.push(`i.status = $${idx++}`); values.push(status); }
  if (severity) { conditions.push(`i.severity = $${idx++}`); values.push(severity); }
  if (date_from) { conditions.push(`i.created_at >= $${idx++}`); values.push(date_from); }
  if (date_to) { conditions.push(`i.created_at <= $${idx++}`); values.push(date_to); }
  if (search) {
    conditions.push(`(i.search_vector @@ plainto_tsquery('english', $${idx}) OR i.id::text ILIKE $${idx + 1})`);
    values.push(search, `%${search}%`);
    idx += 2;
  }
  if (lat && lng) {
    conditions.push(`ST_DWithin(i.location, ST_MakePoint($${idx++}, $${idx++})::geography, $${idx++})`);
    values.push(parseFloat(lng), parseFloat(lat), parseFloat(radius));
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const distanceSelect = lat && lng
    ? `, ST_Distance(i.location, ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)})::geography) AS distance`
    : '';

  const orderMap = {
    newest: 'i.created_at DESC',
    oldest: 'i.created_at ASC',
    upvotes: 'i.upvote_count DESC',
    proximity: lat && lng ? `i.location <-> ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)})::geography` : 'i.created_at DESC',
    status: 'i.status ASC',
  };
  const orderBy = orderMap[sort] || 'i.created_at DESC';

  try {
    values.push(parseInt(limit), offset);
    const query = `
      SELECT i.*, u.name AS reporter_name, u.avatar_url AS reporter_avatar,
             c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon
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
      issues: issuesResult.rows,
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
             ST_Distance(i.location, ST_MakePoint($1, $2)::geography) AS distance
      FROM issues i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE ST_DWithin(i.location, ST_MakePoint($1, $2)::geography, $3)
        AND i.status NOT IN ('resolved', 'rejected')
        AND i.created_at > NOW() - INTERVAL '7 days'
      ORDER BY impact_score DESC
      LIMIT 10
    `, [parseFloat(lng), parseFloat(lat), parseFloat(radius)]);
    res.json({ trending: result.rows });
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
             ST_X(i.location::geometry) AS longitude,
             ST_Y(i.location::geometry) AS latitude,
             ARRAY(SELECT json_build_object('id', m.id, 'url', m.media_url, 'type', m.media_type)
                   FROM issue_media m WHERE m.issue_id = i.id) AS media
      FROM issues i
      LEFT JOIN users u ON i.user_id = u.id
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN subcategories sc ON i.subcategory_id = sc.id
      WHERE i.id = $1
    `, [req.params.id]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Issue not found' });

    // Check if current user voted/followed
    let userInteraction = null;
    if (req.user) {
      const [vote, follow] = await Promise.all([
        pool.query('SELECT vote_type FROM votes WHERE issue_id = $1 AND user_id = $2', [req.params.id, req.user.id]),
        pool.query('SELECT id FROM follows WHERE issue_id = $1 AND user_id = $2', [req.params.id, req.user.id]),
      ]);
      userInteraction = { voted: vote.rows[0]?.vote_type || null, following: !!follow.rows[0] };
    }

    res.json({ issue: result.rows[0], userInteraction });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch issue' });
  }
});

// POST /api/issues - create issue
router.post('/', auth, uploadLimiter, upload.array('media', 5), validate(createIssueSchema), async (req, res) => {
  const { title, description, category_id, subcategory_id, severity, latitude, longitude, address, is_anonymous } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const slaMap = { low: 120, medium: 72, high: 48, critical: 24 };
    const slaHours = slaMap[severity] || 72;
    const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    const issueResult = await client.query(`
      INSERT INTO issues (user_id, title, description, category_id, subcategory_id, severity, location, address, is_anonymous, sla_hours, sla_deadline)
      VALUES ($1, $2, $3, $4, $5, $6, ST_MakePoint($7, $8)::geography, $9, $10, $11, $12)
      RETURNING *
    `, [req.user.id, title, description, category_id, subcategory_id || null, severity, longitude, latitude, address, is_anonymous, slaHours, slaDeadline]);

    const issue = issueResult.rows[0];

    // Save media
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
        const cloudResult = await uploadToCloudinary(file.buffer, {
          folder: 'civicsense/issues',
          resource_type: mediaType,
          public_id: `issue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          transformation: mediaType === 'image' ? [{ quality: 'auto', fetch_format: 'auto' }] : [],
        });
        await client.query(
          'INSERT INTO issue_media (issue_id, media_url, public_id, media_type) VALUES ($1, $2, $3, $4)',
          [issue.id, cloudResult.secure_url, cloudResult.public_id, mediaType]
        );
      }
    }

    // Insert initial status history
    await client.query(
      'INSERT INTO issue_status_history (issue_id, old_status, new_status, updated_by, comment, is_public) VALUES ($1, NULL, $2, $3, $4, TRUE)',
      [issue.id, 'reported', req.user.id, 'Issue reported']
    );

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) io.emit('new_issue', { issue });

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
router.patch('/:id/status', auth, requireRole('admin', 'department_staff'), validate(updateIssueStatusSchema), async (req, res) => {
  const { status, comment, rejection_reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const issueRes = await client.query('SELECT * FROM issues WHERE id = $1', [req.params.id]);
    if (!issueRes.rows[0]) return res.status(404).json({ error: 'Issue not found' });
    const issue = issueRes.rows[0];

    const resolvedAt = status === 'resolved' ? new Date() : undefined;
    const updates = ['status = $1', 'updated_at = NOW()'];
    const values = [status];
    let idx = 2;

    if (rejection_reason) { updates.push(`rejection_reason = $${idx++}`); values.push(rejection_reason); }
    if (resolvedAt) { updates.push(`resolved_at = $${idx++}`); values.push(resolvedAt); }
    values.push(req.params.id);

    const updatedIssue = await client.query(
      `UPDATE issues SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    await client.query(
      'INSERT INTO issue_status_history (issue_id, old_status, new_status, updated_by, comment) VALUES ($1, $2, $3, $4, $5)',
      [issue.id, issue.status, status, req.user.id, comment || null]
    );

    // Notify followers
    const followers = await client.query('SELECT user_id FROM follows WHERE issue_id = $1', [issue.id]);
    for (const f of followers.rows) {
      await client.query(
        'INSERT INTO notifications (user_id, issue_id, type, message) VALUES ($1, $2, $3, $4)',
        [f.user_id, issue.id, 'status_update', `Issue "${issue.title}" status changed to ${status}`]
      );
    }

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) io.to(`issue_${issue.id}`).emit('issue_status_updated', { issueId: issue.id, status, updatedBy: req.user.name });

    res.json({ issue: updatedIssue.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to update status' });
  } finally {
    client.release();
  }
});

// GET /api/issues/:id/history
router.get('/:id/history', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.*, u.name AS updated_by_name, u.role AS updated_by_role
      FROM issue_status_history h
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
