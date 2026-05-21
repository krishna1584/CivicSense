const express = require('express');
const pool = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

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
        SELECT i.*, u.name AS reporter_name, c.name AS category_name, c.icon AS category_icon
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

  if (status) { conditions.push(`i.status = $${idx++}`); values.push(status); }
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
      await client.query(
        'INSERT INTO issue_status_history (issue_id, old_status, new_status, updated_by, comment) VALUES ($1, $2, $3, $4, $5)',
        [issueId, old.rows[0].status, status, req.user.id, comment || `Bulk status update to ${status}`]
      );
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
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.trust_score, u.is_active, u.created_at,
             COUNT(i.id) AS issue_count
      FROM users u LEFT JOIN issues i ON i.user_id = u.id
      ${where}
      GROUP BY u.id ORDER BY u.created_at DESC LIMIT $1 OFFSET $2
    `, values);
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
