const express = require('express');
const pool = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// GET /api/users/me/issues
router.get('/me/issues', auth, async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const conditions = ['i.user_id = $1'];
    const filterValues = [req.user.id];
    let idx = 2;
    if (status) { conditions.push(`i.status = $${idx++}`); filterValues.push(status); }
    const where = conditions.join(' AND ');

    const [result, countResult] = await Promise.all([
      pool.query(`
        SELECT i.id, i.title, i.description, i.status, i.severity, i.upvote_count, i.comment_count,
               i.follow_count, i.address, i.is_anonymous, i.created_at, i.updated_at, i.resolved_at,
               c.name AS category_name, c.icon AS category_icon, c.slug AS category_slug
        FROM issues i
        LEFT JOIN categories c ON i.category_id = c.id
        WHERE ${where}
        ORDER BY i.created_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `, [...filterValues, parseInt(limit), offset]),
      pool.query(`SELECT COUNT(*) FROM issues i WHERE ${where}`, filterValues),
    ]);

    res.json({
      issues: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch your issues' });
  }
});

// GET /api/users/me/dashboard
router.get('/me/dashboard', auth, async (req, res) => {
  try {
    const [issuesRes, votesRes, commentsRes, notifRes] = await Promise.all([
      pool.query(`
        SELECT i.id, i.title, i.status, i.severity, i.upvote_count, i.created_at,
               c.name AS category_name, c.icon AS category_icon
        FROM issues i LEFT JOIN categories c ON i.category_id = c.id
        WHERE i.user_id = $1 ORDER BY i.created_at DESC LIMIT 10
      `, [req.user.id]),
      pool.query('SELECT COUNT(*) FROM votes WHERE user_id = $1', [req.user.id]),
      pool.query('SELECT COUNT(*) FROM comments WHERE user_id = $1', [req.user.id]),
      pool.query('SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE', [req.user.id]),
    ]);

    const statsRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'reported') AS reported,
        COUNT(*) FILTER (WHERE status = 'acknowledged') AS acknowledged,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected
      FROM issues WHERE user_id = $1
    `, [req.user.id]);

    res.json({
      user: req.user,
      recentIssues: issuesRes.rows,
      statusBreakdown: statsRes.rows[0],
      stats: {
        totalVotes: parseInt(votesRes.rows[0].count),
        totalComments: parseInt(commentsRes.rows[0].count),
        unreadNotifications: parseInt(notifRes.rows[0].count),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// GET /api/users/me/notifications
router.get('/me/notifications', auth, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const [notifRes, countRes] = await Promise.all([
      pool.query(
        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [req.user.id, parseInt(limit), offset]
      ),
      pool.query('SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE', [req.user.id]),
    ]);
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE', [req.user.id]);
    res.json({ notifications: notifRes.rows, unreadCount: parseInt(countRes.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/users/me/notifications/unread-count
router.get('/me/notifications/unread-count', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ unreadCount: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch unread notifications count' });
  }
});

// GET /api/users/:id/profile
router.get('/:id/profile', async (req, res) => {
  try {
    const user = await pool.query(
      'SELECT id, name, avatar_url, trust_score, role, created_at FROM users WHERE id = $1 AND is_active = TRUE',
      [req.params.id]
    );
    if (!user.rows[0]) return res.status(404).json({ error: 'User not found' });

    const [stats, satisfaction] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total_issues,
          COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_issues,
          SUM(upvote_count) AS total_upvotes_received
        FROM issues WHERE user_id = $1 AND is_anonymous = FALSE
      `, [req.params.id]),
      pool.query(`
        SELECT
          ROUND(AVG(r.rating)::NUMERIC, 2) AS avg_satisfaction,
          COUNT(r.id) AS satisfaction_reviews
        FROM issue_reviews r
        JOIN issues i ON r.issue_id = i.id
        WHERE i.user_id = $1 AND r.is_hidden = FALSE
      `, [req.params.id]),
    ]);

    res.json({
      user: user.rows[0],
      stats: stats.rows[0],
      satisfaction: satisfaction.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});


// GET /api/users/:id/issues - public non-anonymous issues for a user's profile
router.get('/:id/issues', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const result = await pool.query(`
      SELECT i.id, i.title, i.status, i.severity, i.upvote_count, i.comment_count,
             i.created_at, i.address,
             c.name AS category_name, c.icon AS category_icon, c.slug AS category_slug
      FROM issues i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.user_id = $1 AND i.is_anonymous = FALSE
      ORDER BY i.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.params.id, parseInt(limit), offset]);

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM issues WHERE user_id = $1 AND is_anonymous = FALSE',
      [req.params.id]
    );

    res.json({
      issues: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user issues' });
  }
});



// PATCH /api/users/me
router.patch('/me', auth, upload.single('avatar'), async (req, res) => {
  const { name, address } = req.body;
  const userId = req.user.id;
  let avatarUrl = null;

  try {
    const updates = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(name);
    }

    if (address !== undefined) {
      updates.push(`address = $${idx++}`);
      values.push(address);
    }

    if (req.file) {
      const cloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name';

      if (cloudinaryConfigured) {
        const { uploadToCloudinary } = require('../middleware/upload');
        try {
          const result = await uploadToCloudinary(req.file.buffer, {
            folder: 'civicsense/avatars',
            resource_type: 'image',
            public_id: `avatar_${userId}_${Date.now()}`,
          });
          avatarUrl = result.secure_url;
        } catch (err) {
          console.warn('Cloudinary upload failed for avatar, falling back to local storage:', err.message);
        }
      }

      // Local storage fallback if Cloudinary is not configured or failed
      if (!avatarUrl) {
        const fs = require('fs').promises;
        const path = require('path');
        const ext = path.extname(req.file.originalname) || '.jpg';
        const fileName = `avatar_${userId}_${Date.now()}${ext}`;
        const uploadDir = path.join(__dirname, '../../public/uploads');
        await fs.mkdir(uploadDir, { recursive: true });
        await fs.writeFile(path.join(uploadDir, fileName), req.file.buffer);
        avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;
      }

      updates.push(`avatar_url = $${idx++}`);
      values.push(avatarUrl);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(userId);
    const query = `
      UPDATE users 
      SET ${updates.join(', ')}, updated_at = NOW() 
      WHERE id = $${idx} 
      RETURNING id, name, email, role, trust_score, avatar_url, address, created_at
    `;

    const result = await pool.query(query, values);
    const updatedUser = result.rows[0];

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
