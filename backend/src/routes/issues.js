const express = require('express');
const pool = require('../db/pool');
const { auth, requireRole, optionalAuth } = require('../middleware/auth');
const { validate, createIssueSchema, updateIssueStatusSchema } = require('../middleware/validate');
const { upload, uploadToCloudinary } = require('../middleware/upload');
const { apiLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const issuesService = require('../services/issues.service');

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
    proximity: lat && lng ? `sqrt(power(i.latitude - ${parseFloat(lat)}, 2) + power(i.longitude - ${parseFloat(lng)}, 2))` : 'i.created_at DESC',
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
             (sqrt(power(i.latitude - $2, 2) + power(i.longitude - $1, 2)) * 111139) AS distance
      FROM issues i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE (sqrt(power(i.latitude - $2, 2) + power(i.longitude - $1, 2)) * 111139) <= $3
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
      INSERT INTO issues (user_id, title, description, category_id, subcategory_id, severity, location, latitude, longitude, address, is_anonymous, sla_hours, sla_deadline)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [req.user.id, title, description, category_id, subcategory_id || null, severity, `POINT(${longitude} ${latitude})`, parseFloat(latitude), parseFloat(longitude), address, is_anonymous, slaHours, slaDeadline]);

    const issue = issueResult.rows[0];

    // Save media
    if (req.files && req.files.length > 0) {
      const cloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name';

      for (const file of req.files) {
        const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
        let mediaUrl = null;
        let publicId = null;

        if (cloudinaryConfigured) {
          try {
            const cloudResult = await uploadToCloudinary(file.buffer, {
              folder: 'civicsense/issues',
              resource_type: mediaType,
              public_id: `issue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              transformation: mediaType === 'image' ? [{ quality: 'auto', fetch_format: 'auto' }] : [],
            });
            mediaUrl = cloudResult.secure_url;
            publicId = cloudResult.public_id;
          } catch (err) {
            console.warn('Cloudinary upload failed for issue media, falling back to local storage:', err.message);
          }
        }

        // Local storage fallback if Cloudinary is not configured or failed
        if (!mediaUrl) {
          const fs = require('fs').promises;
          const path = require('path');
          const ext = path.extname(file.originalname) || (mediaType === 'video' ? '.mp4' : '.jpg');
          const fileName = `issue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
          const uploadDir = path.join(__dirname, '../../public/uploads');
          await fs.mkdir(uploadDir, { recursive: true });
          await fs.writeFile(path.join(uploadDir, fileName), file.buffer);
          mediaUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;
          publicId = `local_${fileName}`;
        }

        await client.query(
          'INSERT INTO issue_media (issue_id, media_url, public_id, media_type) VALUES ($1, $2, $3, $4)',
          [issue.id, mediaUrl, publicId, mediaType]
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
router.patch('/:id/status', auth, requireRole('admin', 'department_staff'), upload.array('media', 5), validate(updateIssueStatusSchema), async (req, res) => {
  const { status, comment, rejection_reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const issueRes = await client.query('SELECT * FROM issues WHERE id = $1', [req.params.id]);
    if (!issueRes.rows[0]) return res.status(404).json({ error: 'Issue not found' });
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

    // If status is 'resolved' and media files were uploaded, save them as resolution proofs
    if (isResolving && req.files && req.files.length > 0) {
      for (const file of req.files) {
        const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
        let mediaUrl = null;
        let publicId = null;

        const cloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name';

        if (cloudinaryConfigured) {
          try {
            const { uploadToCloudinary } = require('../middleware/upload');
            const cloudResult = await uploadToCloudinary(file.buffer, {
              folder: 'civicsense/issues',
              resource_type: mediaType,
              public_id: `resolution_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              transformation: mediaType === 'image' ? [{ quality: 'auto', fetch_format: 'auto' }] : [],
            });
            mediaUrl = cloudResult.secure_url;
            publicId = cloudResult.public_id;
          } catch (err) {
            console.warn('Cloudinary upload failed for resolution media, falling back to local storage:', err.message);
          }
        }

        if (!mediaUrl) {
          const fs = require('fs').promises;
          const path = require('path');
          const ext = path.extname(file.originalname) || (mediaType === 'video' ? '.mp4' : '.jpg');
          const fileName = `resolution_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
          const uploadDir = path.join(__dirname, '../../public/uploads');
          await fs.mkdir(uploadDir, { recursive: true });
          await fs.writeFile(path.join(uploadDir, fileName), file.buffer);
          mediaUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;
          publicId = `local_${fileName}`;
        }

        await client.query(
          'INSERT INTO issue_media (issue_id, media_url, public_id, media_type, is_resolution) VALUES ($1, $2, $3, $4, TRUE)',
          [issue.id, mediaUrl, publicId, mediaType]
        );
      }
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

    // Decide new status
    const nextStatus = approved ? 'resolved' : 'in_progress';
    const resolvedAt = nextStatus === 'resolved' ? new Date() : null;

    // Update status
    const updatedRes = await client.query(
      'UPDATE issues SET status = $1, resolved_at = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [nextStatus, resolvedAt, issueId]
    );

    // Record history
    const note = approved 
      ? 'Resolution approved by reporter.' 
      : `Resolution rejected by reporter. Note: ${comment || 'None'}`;

    await client.query(
      'INSERT INTO issue_status_history (issue_id, old_status, new_status, updated_by, comment) VALUES ($1, $2, $3, $4, $5)',
      [issue.id, issue.status, nextStatus, req.user.id, note]
    );

    // Notify followers
    const notifs = await issuesService.notifyFollowers(client, {
      issueId: issue.id,
      issueTitle: issue.title,
      newStatus: nextStatus,
      actorId: req.user.id
    });

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) {
      io.to(`issue_${issue.id}`).emit('issue_status_updated', { issueId: issue.id, status: nextStatus, updatedBy: req.user.name });
      for (const n of notifs) {
        io.to(`user_${n.user_id}`).emit('new_notification', n);
      }
    }

    res.json({ message: `Issue successfully transitioned to ${nextStatus}`, status: nextStatus, issue: updatedRes.rows[0] });
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
