const express = require('express');
const pool = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');
const issuesService = require('../services/issues.service');
const { uploadAvatar, storeUpload } = require('../middleware/upload');
const { getSettings, updateSettings } = require('../services/settings.service');
const { getEmailStatus } = require('../services/mail');
const { uuidParam, UUID_RE } = require('../middleware/validate');

const router = express.Router();
router.param('id', uuidParam);

const ROLES = ['citizen', 'admin', 'department_staff'];

// GET /api/admin/settings/public (Unauthenticated)
router.get('/settings/public', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({
      systemName: settings.systemName,
      enableRegistration: settings.enableRegistration,
      enableAnonymousReporting: settings.enableAnonymousReporting,
      enableAlertBanner: settings.enableAlertBanner,
      alertBannerText: settings.alertBannerText,
      alertBannerType: settings.alertBannerType,
      // Lets sign-up and password-reset pages explain when codes can't be emailed
      emailDelivery: getEmailStatus(),
      hostedOnRender: !!process.env.RENDER, // Render sets RENDER=true on its servers
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
          COUNT(*) FILTER (WHERE sla_deadline < NOW() AND status NOT IN ('resolved','rejected')) AS overdue,
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
                   SELECT json_agg(json_build_object('id', m.id, 'url', m.media_url, 'is_resolution', m.is_resolution))
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
  const { page = 1, limit = 25, status, severity, category, search, sort = 'newest', assigned, moderation } = req.query;
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
  if (moderation) { conditions.push(`i.moderation_status = $${idx++}`); values.push(moderation); }
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
  if (!Array.isArray(issueIds) || !issueIds.length || issueIds.length > 100 || !issueIds.every((id) => typeof id === 'string' && UUID_RE.test(id))) {
    return res.status(400).json({ error: 'issueIds must be a list of up to 100 issue ids' });
  }
  // Resolving needs proof and citizen verification, so it stays a per-issue action.
  if (!['reported', 'acknowledged', 'in_progress', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'This status cannot be applied in bulk.' });
  }

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
      const notifs = await issuesService.notifyFollowers(client, {
        issueId,
        issueTitle: old.rows[0].title,
        newStatus: status,
        actorId: req.user.id,
      });

      const io = req.app.get('io');
      if (io) {
        io.to(`issue_${issueId}`).emit('issue_status_updated', { issueId, status, updatedBy: req.user.name });
        for (const n of notifs) {
          io.to(`user_${n.user_id}`).emit('new_notification', n);
        }
      }
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

// PATCH /api/admin/issues/:id/moderation - approve or reject a held anonymous report
router.patch('/issues/:id/moderation', async (req, res) => {
  const { decision, reason } = req.body;
  if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'Decision must be approve or reject.' });
  const cleanReason = typeof reason === 'string' ? reason.trim() : '';
  if (decision === 'reject' && (!cleanReason || cleanReason.length > 500)) {
    return res.status(400).json({ error: 'A rejection reason of up to 500 characters is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = decision === 'approve'
      ? await client.query(`UPDATE issues SET moderation_status = 'approved', publish_after = NULL, updated_at = NOW() WHERE id = $1 AND moderation_status = 'held' RETURNING id, status`, [req.params.id])
      : await client.query(`UPDATE issues SET moderation_status = 'rejected', status = 'rejected', rejection_reason = $2, publish_after = NULL, updated_at = NOW() WHERE id = $1 AND moderation_status = 'held' RETURNING id, status`, [req.params.id, cleanReason]);

    if (!updated.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This report is not awaiting review.' });
    }

    if (decision === 'reject') {
      await client.query(
        'INSERT INTO issue_status_history (issue_id, old_status, new_status, updated_by, comment) VALUES ($1, $2, $3, $4, $5)',
        [req.params.id, 'reported', 'rejected', req.user.id, `Rejected during review: ${cleanReason}`]
      );
    }
    await client.query(
      `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id, details) VALUES (gen_random_uuid(), $1, $2, 'issue', $3, $4)`,
      [req.user.id, decision === 'approve' ? 'APPROVE_ANONYMOUS_REPORT' : 'REJECT_ANONYMOUS_REPORT', req.params.id, cleanReason || null]
    );
    await client.query('COMMIT');
    res.json({ moderation_status: decision === 'approve' ? 'approved' : 'rejected' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to save the review decision' });
  } finally {
    client.release();
  }
});

// PATCH /api/admin/issues/:id/assign
router.patch('/issues/:id/assign', async (req, res) => {
  const { assigned_to, department } = req.body;
  if (assigned_to && (typeof assigned_to !== 'string' || !UUID_RE.test(assigned_to))) {
    return res.status(400).json({ error: 'assigned_to must be a user id' });
  }
  if (department && (typeof department !== 'string' || department.length > 100)) {
    return res.status(400).json({ error: 'department must be text of up to 100 characters' });
  }
  try {
    const result = await pool.query(
      'UPDATE issues SET assigned_to = $1, department = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [assigned_to || null, department || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Issue not found' });
    res.json({ issue: result.rows[0] });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Assigned user not found' });
    res.status(500).json({ error: 'Failed to assign issue' });
  }
});

// GET /api/admin/analytics
router.get('/analytics', async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.period, 10) || 30, 1), 365);
  try {
    const [resolutionTrend, categoryTrend, departmentPerf, deptSatisfaction, catSatisfaction] = await Promise.all([
      pool.query(`
        SELECT DATE(created_at) AS date, COUNT(*) AS reported,
               COUNT(*) FILTER (WHERE status = 'resolved') AS resolved
        FROM issues WHERE created_at > NOW() - INTERVAL '${days} days'
        GROUP BY date ORDER BY date ASC
      `),
      pool.query(`
        SELECT c.name, COUNT(i.id) AS total,
               COUNT(i.id) FILTER (WHERE i.status = 'resolved') AS resolved,
               ROUND(AVG(EXTRACT(EPOCH FROM (i.resolved_at - i.created_at))/3600) FILTER (WHERE i.status = 'resolved'), 1) AS avg_hours
        FROM categories c LEFT JOIN issues i ON i.category_id = c.id
        WHERE i.created_at > NOW() - INTERVAL '${days} days'
        GROUP BY c.id ORDER BY total DESC
      `),
      pool.query(`
        SELECT department, COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
               ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) FILTER (WHERE status = 'resolved'), 1) AS avg_hours
        FROM issues WHERE department IS NOT NULL
        GROUP BY department ORDER BY total DESC
      `),
      // Department satisfaction: avg review rating per department
      pool.query(`
        SELECT i.department,
               ROUND(AVG(r.rating)::NUMERIC, 2) AS avg_rating,
               COUNT(r.id) AS review_count
        FROM issue_reviews r
        JOIN issues i ON r.issue_id = i.id
        WHERE i.department IS NOT NULL AND r.is_hidden = FALSE
        GROUP BY i.department
        ORDER BY avg_rating DESC
      `),
      // Category satisfaction: avg review rating per category
      pool.query(`
        SELECT c.name AS category, c.icon,
               ROUND(AVG(r.rating)::NUMERIC, 2) AS avg_rating,
               COUNT(r.id) AS review_count
        FROM issue_reviews r
        JOIN issues i ON r.issue_id = i.id
        JOIN categories c ON i.category_id = c.id
        WHERE r.is_hidden = FALSE
        GROUP BY c.id
        ORDER BY avg_rating DESC
      `),
    ]);

    res.json({
      resolutionTrend: resolutionTrend.rows,
      categoryTrend: categoryTrend.rows,
      departmentPerf: departmentPerf.rows,
      deptSatisfaction: deptSatisfaction.rows,
      catSatisfaction: catSatisfaction.rows,
    });
  } catch (err) {
    console.error('Analytics error:', err);
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
router.patch('/users/:id', requireRole('admin'), uploadAvatar.single('avatar'), async (req, res) => {
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

    if (role !== undefined && !ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });
    }
    if (isActiveVal !== undefined && typeof isActiveVal !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be true or false' });
    }
    // Stops an admin locking themselves (and possibly everyone) out of the admin panel.
    if (targetUserId === req.user.id && ((role !== undefined && role !== 'admin') || isActiveVal === false)) {
      return res.status(400).json({ error: "You can't remove your own admin access or deactivate your own account." });
    }

    if (role !== undefined) {
      updates.push(`role = $${idx++}`);
      values.push(role);
    }
    if (isActiveVal !== undefined) {
      updates.push(`is_active = $${idx++}`);
      values.push(isActiveVal);
    }

    if (req.file) {
      ({ mediaUrl: avatarUrl } = await storeUpload(req.file, req, { folder: 'civicsense/avatars', prefix: `avatar_${targetUserId}` }));
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
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "You can't delete your own account." });
  }
  try {
    // Audit history must survive, so anyone who has acted as staff is deactivated, not deleted.
    const history = await pool.query(`
      SELECT EXISTS (SELECT 1 FROM admin_logs WHERE admin_id = $1)
          OR EXISTS (SELECT 1 FROM issue_status_history h JOIN issues i ON i.id = h.issue_id
                     WHERE h.updated_by = $1 AND i.user_id IS DISTINCT FROM $1) AS has_history
    `, [req.params.id]);
    if (history.rows[0].has_history) {
      return res.status(409).json({ error: 'This user has audit history and cannot be deleted. Deactivate the account instead.' });
    }

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
  const { page = 1, limit = 50, type = 'users' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    if (type === 'issues') {
      const [logsResult, countResult] = await Promise.all([
        pool.query(`
          SELECT h.id, h.issue_id, h.old_status, h.new_status, h.comment as details, h.updated_at as created_at,
                 COALESCE(u.name, 'System') as admin_name, u.email as admin_email,
                 i.title as issue_title
          FROM issue_status_history h
          LEFT JOIN users u ON h.updated_by = u.id
          JOIN issues i ON h.issue_id = i.id
          ORDER BY h.updated_at DESC
          LIMIT $1 OFFSET $2
        `, [parseInt(limit), offset]),
        pool.query(`
          SELECT COUNT(*) 
          FROM issue_status_history h
          JOIN issues i ON h.issue_id = i.id
        `)
      ]);

      const mappedLogs = logsResult.rows.map(row => ({
        id: row.id,
        created_at: row.created_at,
        admin_name: row.admin_name,
        admin_email: row.admin_email,
        action: row.old_status ? `STATUS: ${row.old_status.toUpperCase()} ➔ ${row.new_status.toUpperCase()}` : `REPORTED`,
        entity_type: 'issue',
        entity_id: row.issue_id,
        issue_id: row.issue_id,
        issue_title: row.issue_title,
        old_status: row.old_status,
        new_status: row.new_status,
        details: row.details
      }));

      res.json({
        logs: mappedLogs,
        total: parseInt(countResult.rows[0].count)
      });
    } else {
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
    }
  } catch (err) {
    console.error('Failed to fetch admin logs:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// GET /api/admin/settings (Authenticated: Admin or Department Staff)
router.get('/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PATCH /api/admin/settings (Authenticated: Admin only)
router.patch('/settings', requireRole('admin'), async (req, res) => {
  try {
    const updated = await updateSettings(req.body);

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
    if (err.status === 400) return res.status(400).json({ error: err.message });
    console.error('Settings update error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
