const express = require('express');
const pool = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');
const issuesService = require('../services/issues.service');
const { upload } = require('../middleware/upload');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');

// Default settings
const DEFAULT_SETTINGS = {
  systemName: "CivicSense Command Center",
  supportEmail: "support@civicsense.gov",
  enableRegistration: true,
  minUpvotesForAutoAcknowledge: 5,
  enableAnonymousReporting: true,
  allowGuestComments: false,
  enableAlertBanner: false,
  alertBannerText: "",
  alertBannerType: "warning"
};

// Helper to get settings
async function getSettingsData() {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    try {
      await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8');
    } catch (_) {}
    return DEFAULT_SETTINGS;
  }
}

// GET /api/admin/settings/public (Unauthenticated)
router.get('/settings/public', async (req, res) => {
  try {
    const settings = await getSettingsData();
    res.json({
      systemName: settings.systemName,
      enableRegistration: settings.enableRegistration,
      enableAnonymousReporting: settings.enableAnonymousReporting,
      enableAlertBanner: settings.enableAlertBanner,
      alertBannerText: settings.alertBannerText,
      alertBannerType: settings.alertBannerType
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch public settings' });
  }
});

// All admin routes require auth + admin/department_staff role
router.use(auth, requireRole('admin', 'department_staff'));

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [overview, byStatus, bySeverity, byCat, slaViolations, recentIssues] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status NOT IN ('resolved','rejected')) AS active,
          COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
          COUNT(*) FILTER (WHERE severity = 'critical' AND status NOT IN ('resolved','rejected')) AS critical_active,
          ROUND(COUNT(*) FILTER (WHERE status = 'resolved')::NUMERIC / NULLIF(COUNT(*),0) * 100, 1) AS resolution_rate,
          ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) FILTER (WHERE status = 'resolved'), 1) AS avg_resolution_hours,
          ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) FILTER (WHERE status != 'reported'), 1) AS avg_acknowledge_hours
        FROM issues
      `),
      pool.query(`SELECT status, COUNT(*) AS count FROM issues GROUP BY status`),
      pool.query(`SELECT severity, COUNT(*) AS count FROM issues GROUP BY severity`),
      pool.query(`SELECT c.name, c.icon, COUNT(i.id) AS count FROM categories c LEFT JOIN issues i ON i.category_id = c.id GROUP BY c.id ORDER BY count DESC`),
      pool.query(`
        SELECT i.id, i.title, i.severity, i.status, i.sla_deadline, i.created_at, u.name AS reporter
        FROM issues i LEFT JOIN users u ON i.user_id = u.id
        WHERE i.sla_deadline < NOW() AND i.status NOT IN ('resolved','rejected')
        ORDER BY i.sla_deadline ASC LIMIT 10
      `),
      pool.query(`
        SELECT i.*, u.name AS reporter_name, c.name AS category_name, c.icon AS category_icon,
               COALESCE(
                 (
                   SELECT json_agg(json_build_object('id', m.id, 'url', m.media_url))
                   FROM issue_media m WHERE m.issue_id = i.id
                 ),
                 '[]'::json
               ) AS media
        FROM issues i LEFT JOIN users u ON i.user_id = u.id LEFT JOIN categories c ON i.category_id = c.id
        ORDER BY i.created_at DESC LIMIT 20
      `),
    ]);

    res.json({
      overview: overview.rows[0],
      byStatus: byStatus.rows,
      bySeverity: bySeverity.rows,
      byCategory: byCat.rows,
      slaViolations: slaViolations.rows,
      recentIssues: recentIssues.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load admin dashboard' });
  }
});

// GET /api/admin/issues - paginated with all filters
router.get('/issues', async (req, res) => {
  const { page = 1, limit = 25, status, severity, category, search, sort = 'newest', assigned } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const conditions = [];
  const values = [];
  let idx = 1;

  if (status) {
    if (status === 'unresolved') {
      conditions.push(`i.status != 'resolved'`);
    } else {
      conditions.push(`i.status = $${idx++}`);
      values.push(status);
    }
  }
  if (severity) { conditions.push(`i.severity = $${idx++}`); values.push(severity); }
  if (assigned) { conditions.push(`i.assigned_to = $${idx++}`); values.push(assigned); }
  if (search) { conditions.push(`i.search_vector @@ plainto_tsquery('english', $${idx++})`); values.push(search); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderMap = { newest: 'i.created_at DESC', oldest: 'i.created_at ASC', severity: 'i.severity DESC', sla: 'i.sla_deadline ASC' };
  const orderBy = orderMap[sort] || 'i.created_at DESC';

  try {
    values.push(parseInt(limit), offset);
    const result = await pool.query(`
      SELECT i.*, u.name AS reporter_name, c.name AS category_name, c.icon AS category_icon,
             au.name AS assigned_to_name,
             CASE WHEN i.sla_deadline < NOW() AND i.status NOT IN ('resolved','rejected') THEN TRUE ELSE FALSE END AS sla_breached
      FROM issues i
      LEFT JOIN users u ON i.user_id = u.id
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users au ON i.assigned_to = au.id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${idx++} OFFSET $${idx++}
    `, values);

    const countResult = await pool.query(`SELECT COUNT(*) FROM issues i ${where}`, values.slice(0, values.length - 2));
    res.json({ issues: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

// PATCH /api/admin/issues/bulk-status
router.patch('/issues/bulk-status', requireRole('admin'), async (req, res) => {
  const { issueIds, status, comment } = req.body;
  if (!Array.isArray(issueIds) || !issueIds.length) return res.status(400).json({ error: 'issueIds required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const issueId of issueIds) {
      const old = await client.query('SELECT status, title FROM issues WHERE id = $1', [issueId]);
      if (!old.rows[0]) continue;
      await client.query('UPDATE issues SET status = $1, updated_at = NOW() WHERE id = $2', [status, issueId]);
      const historyId = require('crypto').randomUUID();
      await client.query(
        'INSERT INTO issue_status_history (id, issue_id, old_status, new_status, updated_by, comment) VALUES ($1, $2, $3, $4, $5, $6)',
        [historyId, issueId, old.rows[0].status, status, req.user.id, comment || `Bulk status update to ${status}`]
      );
      
      // Notify stakeholders (reporter, followers, upvoters)
      await issuesService.notifyFollowers(client, {
        issueId,
        issueTitle: old.rows[0].title,
        newStatus: status,
        actorId: req.user.id,
      });
    }
    await client.query('COMMIT');
    res.json({ message: `Updated ${issueIds.length} issues to ${status}` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Bulk update failed' });
  } finally {
    client.release();
  }
});

// PATCH /api/admin/issues/:id/assign
router.patch('/issues/:id/assign', async (req, res) => {
  const { assigned_to, department } = req.body;
  try {
    const result = await pool.query(
      'UPDATE issues SET assigned_to = $1, department = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [assigned_to || null, department || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Issue not found' });
    res.json({ issue: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign issue' });
  }
});

// GET /api/admin/analytics
router.get('/analytics', async (req, res) => {
  const { period = '30' } = req.query;
  try {
    const [resolutionTrend, categoryTrend, departmentPerf] = await Promise.all([
      pool.query(`
        SELECT DATE(created_at) AS date, COUNT(*) AS reported,
               COUNT(*) FILTER (WHERE status = 'resolved') AS resolved
        FROM issues WHERE created_at > NOW() - INTERVAL '${parseInt(period)} days'
        GROUP BY date ORDER BY date ASC
      `),
      pool.query(`
        SELECT c.name, COUNT(i.id) AS total,
               COUNT(i.id) FILTER (WHERE i.status = 'resolved') AS resolved,
               ROUND(AVG(EXTRACT(EPOCH FROM (i.resolved_at - i.created_at))/3600) FILTER (WHERE i.status = 'resolved'), 1) AS avg_hours
        FROM categories c LEFT JOIN issues i ON i.category_id = c.id
        WHERE i.created_at > NOW() - INTERVAL '${parseInt(period)} days'
        GROUP BY c.id ORDER BY total DESC
      `),
      pool.query(`
        SELECT department, COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
               ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) FILTER (WHERE status = 'resolved'), 1) AS avg_hours
        FROM issues WHERE department IS NOT NULL
        GROUP BY department ORDER BY total DESC
      `),
    ]);

    res.json({ resolutionTrend: resolutionTrend.rows, categoryTrend: categoryTrend.rows, departmentPerf: departmentPerf.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/admin/users
router.get('/users', requireRole('admin'), async (req, res) => {
  const { page = 1, limit = 25, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const where = search ? `WHERE u.name ILIKE $3 OR u.email ILIKE $3` : '';
    const values = search ? [parseInt(limit), offset, `%${search}%`] : [parseInt(limit), offset];
    
    const [usersResult, countResult] = await Promise.all([
      pool.query(`
        SELECT u.id, u.name, u.email, u.role, u.trust_score, u.is_active, u.created_at, u.avatar_url,
               COUNT(i.id) AS issue_count
        FROM users u LEFT JOIN issues i ON i.user_id = u.id
        ${where}
        GROUP BY u.id ORDER BY u.created_at DESC LIMIT $1 OFFSET $2
      `, values),
      pool.query(`SELECT COUNT(*) FROM users u ${where}`, search ? [`%${search}%`] : [])
    ]);

    res.json({ 
      users: usersResult.rows,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', requireRole('admin'), upload.single('avatar'), async (req, res) => {
  const { role, is_active } = req.body;
  const targetUserId = req.params.id;
  let avatarUrl = null;

  try {
    const updates = [];
    const values = [];
    let idx = 1;

    let isActiveVal = is_active;
    if (is_active === 'true') isActiveVal = true;
    if (is_active === 'false') isActiveVal = false;

    if (role !== undefined) {
      updates.push(`role = $${idx++}`);
      values.push(role);
    }
    if (isActiveVal !== undefined) {
      updates.push(`is_active = $${idx++}`);
      values.push(isActiveVal);
    }

    if (req.file) {
      const cloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name';

      if (cloudinaryConfigured) {
        const { uploadToCloudinary } = require('../middleware/upload');
        const fs = require('fs');
        try {
          const result = await uploadToCloudinary(req.file.path, {
            folder: 'civicsense/avatars',
            resource_type: 'image',
            public_id: `avatar_${targetUserId}_${Date.now()}`,
          });
          avatarUrl = result.secure_url;
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.warn('Cloudinary upload failed for avatar, using local path:', err.message);
          avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }
      } else {
        avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      }

      updates.push(`avatar_url = $${idx++}`);
      values.push(avatarUrl);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push(`updated_at = NOW()`);
    values.push(targetUserId);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, email, role, is_active, avatar_url`,
      values
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });

    // Log the action
    await pool.query(
      `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id, details)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
      [req.user.id, 'UPDATE_USER', 'user', targetUserId, JSON.stringify({ role, is_active: isActiveVal, avatar_url: avatarUrl || undefined })]
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });

    await pool.query(
      `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
      [req.user.id, 'DELETE_USER', 'user', req.params.id]
    );

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// DELETE /api/admin/comments/:id
router.delete('/comments/:id', requireRole('admin', 'department_staff'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM comments WHERE id = $1 RETURNING id, issue_id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Comment not found' });

    await pool.query(
      `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
      [req.user.id, 'DELETE_COMMENT', 'comment', req.params.id]
    );

    res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// GET /api/admin/logs
router.get('/logs', requireRole('admin'), async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const [logsResult, countResult] = await Promise.all([
      pool.query(`
        SELECT l.*, u.name as admin_name, u.email as admin_email
        FROM admin_logs l
        JOIN users u ON l.admin_id = u.id
        ORDER BY l.created_at DESC
        LIMIT $1 OFFSET $2
      `, [parseInt(limit), offset]),
      pool.query('SELECT COUNT(*) FROM admin_logs')
    ]);

    res.json({ 
      logs: logsResult.rows,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// GET /api/admin/settings (Authenticated: Admin or Department Staff)
router.get('/settings', async (req, res) => {
  try {
    const settings = await getSettingsData();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PATCH /api/admin/settings (Authenticated: Admin only)
router.patch('/settings', requireRole('admin'), async (req, res) => {
  try {
    const current = await getSettingsData();
    const updated = { ...current, ...req.body };
    
    // Save to settings.json
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf8');

    // Audit log using PostgreSQL gen_random_uuid()
    await pool.query(
      `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id, details)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'UPDATE_SETTINGS',
        'settings',
        req.user.id,
        `System settings updated: ${Object.keys(req.body).join(', ')}`
      ]
    );

    res.json(updated);
  } catch (err) {
    console.error('Settings update error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
