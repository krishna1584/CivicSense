/**
 * issues.service.js
 * All database queries for the issues domain.
 * No Express request/response objects here — pure data access.
 */
const pool = require('../db/pool');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build ORDER BY clause from sort param */
const buildOrderBy = (sort) => {
  const map = {
    newest:   'i.created_at DESC',
    oldest:   'i.created_at ASC',
    upvotes:  'i.upvote_count DESC',
    comments: 'i.comment_count DESC',
  };
  return map[sort] || 'i.created_at DESC';
};

/** Standard SELECT projection shared by list/get queries */
const ISSUE_SELECT = `
  i.*,
  u.name        AS reporter_name,
  u.avatar_url  AS reporter_avatar,
  u.trust_score AS reporter_trust,
  c.name        AS category_name,
  c.slug        AS category_slug,
  c.icon        AS category_icon
`;

/**
 * Prepare an issue row for a public response. Reporter details on anonymous
 * issues are only returned to the reporter themselves.
 */
function presentIssue(issue, viewerId) {
  const is_owner = !!viewerId && issue.user_id === viewerId;
  if (!issue.is_anonymous || is_owner) return { ...issue, is_owner };
  return { ...issue, is_owner, user_id: null, reporter_name: null, reporter_avatar: null, reporter_trust: null };
}

// Anonymous reports are held for review and publish themselves once the window
// passes. Computing this at read time means there is no job that can be missed.
const PUBLIC_ISSUE_SQL = `(i.moderation_status = 'approved' OR (i.moderation_status = 'held' AND i.publish_after <= NOW()))`;
const ANONYMOUS_REVIEW_HOURS = 24;
const ANONYMOUS_VERIFICATION_DAYS = 7;
const SLA_HOURS = { low: 120, medium: 72, high: 48, critical: 24 };

/** Insert a report, its media and first history entry inside the caller's transaction. */
async function insertReport(client, { userId, fields, isAnonymous, media, holdForReview, historyComment }) {
  const { title, description, category_id, subcategory_id, severity, latitude, longitude, address } = fields;
  const slaHours = SLA_HOURS[severity] || 72;
  const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);
  const publishAfter = holdForReview ? new Date(Date.now() + ANONYMOUS_REVIEW_HOURS * 60 * 60 * 1000) : null;

  const result = await client.query(`
    INSERT INTO issues (user_id, title, description, category_id, subcategory_id, severity, location, latitude, longitude, address, is_anonymous, sla_hours, sla_deadline, moderation_status, publish_after)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *
  `, [userId, title, description, category_id, subcategory_id || null, severity, `POINT(${longitude} ${latitude})`, parseFloat(latitude), parseFloat(longitude), address, isAnonymous, slaHours, slaDeadline, holdForReview ? 'held' : 'approved', publishAfter]);
  const issue = result.rows[0];

  for (const { mediaUrl, publicId, mediaType } of media) {
    await client.query(
      'INSERT INTO issue_media (issue_id, media_url, public_id, media_type) VALUES ($1, $2, $3, $4)',
      [issue.id, mediaUrl, publicId, mediaType]
    );
  }

  await client.query(
    'INSERT INTO issue_status_history (issue_id, old_status, new_status, updated_by, comment, is_public) VALUES ($1, NULL, $2, $3, $4, TRUE)',
    [issue.id, 'reported', userId, historyComment]
  );
  return issue;
}

/** Apply a reporter's accept/reject decision inside the caller's transaction. */
async function recordResolutionDecision(client, issue, { approved, comment, actorId }) {
  const nextStatus = approved ? 'resolved' : 'in_progress';
  const updated = await client.query(
    'UPDATE issues SET status = $1, resolved_at = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
    [nextStatus, approved ? new Date() : null, issue.id]
  );
  const note = approved
    ? 'Resolution approved by reporter.'
    : `Resolution rejected by reporter. Note: ${comment || 'None'}`;
  await client.query(
    'INSERT INTO issue_status_history (issue_id, old_status, new_status, updated_by, comment) VALUES ($1, $2, $3, $4, $5)',
    [issue.id, issue.status, nextStatus, actorId, note]
  );
  const notifications = await notifyFollowers(client, { issueId: issue.id, issueTitle: issue.title, newStatus: nextStatus, actorId });
  return { nextStatus, updatedIssue: updated.rows[0], notifications };
}

/** An anonymous reporter can lose their token, so an unanswered resolution eventually closes. */
async function closeUnansweredAnonymousReports() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const expired = await client.query(`
      SELECT i.id, i.title, i.status FROM issues i
      WHERE i.user_id IS NULL AND i.status = 'pending_verification'
        AND (SELECT MAX(h.updated_at) FROM issue_status_history h
             WHERE h.issue_id = i.id AND h.new_status = 'pending_verification')
            < NOW() - make_interval(days => $1)
      FOR UPDATE
    `, [ANONYMOUS_VERIFICATION_DAYS]);

    for (const issue of expired.rows) {
      await client.query(`UPDATE issues SET status = 'resolved', resolved_at = NOW(), updated_at = NOW() WHERE id = $1`, [issue.id]);
      await client.query(
        'INSERT INTO issue_status_history (issue_id, old_status, new_status, updated_by, comment) VALUES ($1, $2, $3, NULL, $4)',
        [issue.id, issue.status, 'resolved', `Closed automatically: no response from the anonymous reporter within ${ANONYMOUS_VERIFICATION_DAYS} days.`]
      );
      await notifyFollowers(client, { issueId: issue.id, issueTitle: issue.title, newStatus: 'resolved' });
    }
    await client.query('COMMIT');
    return expired.rows.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Category queries ──────────────────────────────────────────────────────────

async function getAllCategories() {
  const result = await pool.query('SELECT * FROM categories ORDER BY name ASC');
  return result.rows;
}

// ── Issue list query ──────────────────────────────────────────────────────────

/**
 * List issues with optional filters, search, sort and pagination.
 * @param {object} filters - { category, status, severity, sort, search, date_from, date_to, page, limit }
 * @returns {{ issues: object[], total: number }}
 */
async function listIssues({ category, status, severity, sort = 'newest', search, date_from, date_to, page = 1, limit = 12 } = {}) {
  const values = [];
  const conditions = [];
  let idx = 1;

  if (category)  { conditions.push(`c.slug = $${idx++}`);          values.push(category); }
  if (status)    { conditions.push(`i.status = $${idx++}`);         values.push(status); }
  if (severity)  { conditions.push(`i.severity = $${idx++}`);       values.push(severity); }
  if (date_from) { conditions.push(`i.created_at >= $${idx++}`);    values.push(date_from); }
  if (date_to)   { conditions.push(`i.created_at <= $${idx++}`);    values.push(date_to); }

  if (search) {
    conditions.push(`(
      LOWER(i.title) LIKE LOWER($${idx})
      OR LOWER(i.description) LIKE LOWER($${idx + 1})
    )`);
    values.push(`%${search}%`, `%${search}%`);
    idx += 2;
  }

  const where   = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = buildOrderBy(sort);
  const offset  = (parseInt(page) - 1) * parseInt(limit);

  const dataValues  = [...values, parseInt(limit), offset];
  const countValues = [...values];

  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `SELECT ${ISSUE_SELECT},
              COALESCE(
                ARRAY(
                  SELECT json_build_object('id', m.id, 'url', m.media_url, 'type', m.media_type, 'is_resolution', m.is_resolution)
                  FROM issue_media m WHERE m.issue_id = i.id
                ),
                ARRAY[]::json[]
              ) AS media
       FROM issues i
       LEFT JOIN users      u ON i.user_id     = u.id
       LEFT JOIN categories c ON i.category_id = c.id
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${idx++} OFFSET $${idx++}`,
      dataValues
    ),
    pool.query(
      `SELECT COUNT(*) FROM issues i
       LEFT JOIN categories c ON i.category_id = c.id
       ${where}`,
      countValues
    ),
  ]);

  return {
    issues: dataResult.rows,
    total:  parseInt(countResult.rows[0].count),
  };
}

// ── Single issue ──────────────────────────────────────────────────────────────

/**
 * Fetch one issue by ID, including media array and subcategory.
 * @param {string} issueId
 * @returns {object|null}
 */
async function getIssueById(issueId) {
  const result = await pool.query(
    `SELECT ${ISSUE_SELECT},
            sc.name AS subcategory_name,
            COALESCE(
              ARRAY(
                SELECT json_build_object('id', m.id, 'url', m.media_url, 'type', m.media_type, 'is_resolution', m.is_resolution)
                FROM issue_media m WHERE m.issue_id = i.id
              ),
              ARRAY[]::json[]
            ) AS media
     FROM issues i
     LEFT JOIN users        u  ON i.user_id        = u.id
     LEFT JOIN categories   c  ON i.category_id    = c.id
     LEFT JOIN subcategories sc ON i.subcategory_id = sc.id
     WHERE i.id = $1`,
    [issueId]
  );
  return result.rows[0] || null;
}

// ── Create issue ──────────────────────────────────────────────────────────────

/**
 * Insert a new issue inside a caller-supplied transaction client.
 * @param {object} client  - pg PoolClient (transaction already begun)
 * @param {object} payload - validated fields
 * @returns {object} inserted row
 */
async function createIssue(client, {
  id, user_id, title, description, category_id, subcategory_id,
  severity, latitude, longitude, address, is_anonymous, sla_hours, sla_deadline,
}) {
  const result = await client.query(
    `INSERT INTO issues
       (id, user_id, title, description, category_id, subcategory_id,
        severity, latitude, longitude, address, is_anonymous, sla_hours, sla_deadline)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      id, user_id, title, description, category_id, subcategory_id || null,
      severity, latitude || null, longitude || null, address || null,
      is_anonymous, sla_hours, sla_deadline,
    ]
  );
  return result.rows[0];
}

// ── Media ─────────────────────────────────────────────────────────────────────

/**
 * Insert a media record for an issue.
 * @param {object} client
 * @param {{ issueId, url, publicId, type }} params
 */
async function insertIssueMedia(client, { issueId, url, publicId, type }) {
  await client.query(
    `INSERT INTO issue_media (issue_id, media_url, public_id, media_type)
     VALUES ($1, $2, $3, $4)`,
    [issueId, url, publicId || null, type]
  );
}

// ── Status history ────────────────────────────────────────────────────────────

/**
 * Insert a status history entry.
 * @param {object} client
 * @param {{ issueId, oldStatus, newStatus, updatedBy, comment, isPublic }} params
 */
async function insertStatusHistory(client, { issueId, oldStatus, newStatus, updatedBy, comment, isPublic = true }) {
  await client.query(
    `INSERT INTO issue_status_history
       (issue_id, old_status, new_status, updated_by, comment, is_public)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [issueId, oldStatus || null, newStatus, updatedBy, comment || null, isPublic]
  );
}

// ── Update status ─────────────────────────────────────────────────────────────

/**
 * Update issue status and optionally set rejection_reason / resolved_at.
 * @param {object} client
 * @param {string} issueId
 * @param {{ status, rejection_reason }} updates
 * @returns {object} updated row
 */
async function updateIssueStatus(client, issueId, { status, rejection_reason }) {
  const setClauses = ['status = $1', 'updated_at = NOW()'];
  const values = [status];
  let idx = 2;

  if (rejection_reason) {
    setClauses.push(`rejection_reason = $${idx++}`);
    values.push(rejection_reason);
  }
  if (status === 'resolved') {
    setClauses.push(`resolved_at = NOW()`);
  }

  values.push(issueId);
  const result = await client.query(
    `UPDATE issues SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0];
}

// ── Notify followers ──────────────────────────────────────────────────────────

/**
 * Create in-app notifications for all followers of an issue.
 * @param {object} client
 * @param {{ issueId, issueTitle, newStatus }} params
 */
async function notifyFollowers(client, { issueId, issueTitle, newStatus, actorId }) {
  const sql = `
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM follows WHERE issue_id = $1
      UNION
      SELECT user_id FROM votes WHERE issue_id = $1 AND vote_type = 'upvote'
      UNION
      SELECT user_id AS user_id FROM issues WHERE id = $1 AND user_id IS NOT NULL
    ) AS recipients
  `;
  const result = await client.query(sql, [issueId]);

  const notifications = [];
  for (const { user_id } of result.rows) {
    const notifId = require('crypto').randomUUID();
    const msg = `Issue "${issueTitle}" is now ${newStatus}`;
    await client.query(
      `INSERT INTO notifications (id, user_id, issue_id, type, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [notifId, user_id, issueId, 'status_update', msg]
    );
    notifications.push({
      id: notifId,
      user_id,
      issue_id: issueId,
      type: 'status_update',
      message: msg,
      is_read: false,
      created_at: new Date().toISOString()
    });
  }

  // Send resolution emails to the original reporter only
  if (newStatus === 'pending_verification' || newStatus === 'resolved') {
    try {
      const { sendResolutionPendingEmail, sendResolvedEmail } = require('./mail');
      const reporterResult = await client.query(
        `SELECT u.email, u.name FROM issues i JOIN users u ON i.user_id = u.id WHERE i.id = $1`,
        [issueId]
      );
      const reporter = reporterResult.rows[0];
      if (reporter) {
        if (newStatus === 'pending_verification') {
          sendResolutionPendingEmail(reporter.email, reporter.name, issueTitle, issueId).catch(err =>
            console.error('Resolution-pending email failed:', err.message)
          );
        } else if (newStatus === 'resolved') {
          sendResolvedEmail(reporter.email, reporter.name, issueTitle, issueId).catch(err =>
            console.error('Resolved email failed:', err.message)
          );
        }
      }
    } catch (emailErr) {
      console.error('Failed to send resolution email:', emailErr.message);
    }
  }

  return notifications;
}

// ── Status history list ───────────────────────────────────────────────────────

async function getStatusHistory(issueId) {
  const result = await pool.query(
    `SELECT h.*, u.name AS updated_by_name, u.role AS updated_by_role
     FROM issue_status_history h
     LEFT JOIN users u ON h.updated_by = u.id
     WHERE h.issue_id = $1 AND h.is_public = TRUE
     ORDER BY h.updated_at ASC`,
    [issueId]
  );
  return result.rows;
}

// ── User vote / follow state ──────────────────────────────────────────────────

async function getUserInteraction(issueId, userId) {
  const [vote, follow] = await Promise.all([
    pool.query('SELECT vote_type FROM votes  WHERE issue_id = $1 AND user_id = $2', [issueId, userId]),
    pool.query('SELECT id        FROM follows WHERE issue_id = $1 AND user_id = $2', [issueId, userId]),
  ]);
  return {
    voted:     vote.rows[0]?.vote_type || null,
    following: !!follow.rows[0],
  };
}

module.exports = {
  PUBLIC_ISSUE_SQL,
  insertReport,
  recordResolutionDecision,
  closeUnansweredAnonymousReports,
  presentIssue,
  getAllCategories,
  listIssues,
  getIssueById,
  createIssue,
  insertIssueMedia,
  insertStatusHistory,
  updateIssueStatus,
  notifyFollowers,
  getStatusHistory,
  getUserInteraction,
};
