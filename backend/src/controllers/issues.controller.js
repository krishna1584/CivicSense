/**
 * issues.controller.js
 * Route handlers for the issues domain.
 * Each function handles exactly one endpoint — no DB queries here.
 */
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { uploadToCloudinary } = require('../middleware/upload');
const issuesService = require('../services/issues.service');

// ── SLA config ────────────────────────────────────────────────────────────────
const SLA_HOURS = { low: 120, medium: 72, high: 48, critical: 24 };

// ────────────────────────────────────────────────────────────────────────────
// GET /api/issues/categories/all
// ────────────────────────────────────────────────────────────────────────────
async function getCategories(req, res) {
  try {
    const categories = await issuesService.getAllCategories();
    console.log(`📋 Found ${categories.length} categories`);
    res.json({ categories });
  } catch (err) {
    console.error('getCategories:', err.message);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/issues
// ────────────────────────────────────────────────────────────────────────────
async function listIssues(req, res) {
  try {
    const { page = 1, limit = 12, category, status, severity,
            sort = 'newest', search, date_from, date_to } = req.query;

    const result = await issuesService.listIssues({
      category, status, severity, sort, search, date_from, date_to,
      page: parseInt(page), limit: parseInt(limit),
    });

    res.json({
      issues:     result.issues,
      total:      result.total,
      page:       parseInt(page),
      limit:      parseInt(limit),
      totalPages: Math.ceil(result.total / parseInt(limit)),
    });
  } catch (err) {
    console.error('listIssues:', err.message);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/issues/:id
// ────────────────────────────────────────────────────────────────────────────
async function getIssue(req, res) {
  try {
    const issue = await issuesService.getIssueById(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });

    let userInteraction = null;
    if (req.user) {
      userInteraction = await issuesService.getUserInteraction(issue.id, req.user.id);
    }

    res.json({ issue, userInteraction });
  } catch (err) {
    console.error('getIssue:', err.message);
    res.status(500).json({ error: 'Failed to fetch issue' });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/issues
// ────────────────────────────────────────────────────────────────────────────
async function createIssue(req, res) {
  const {
    title, description, category_id, subcategory_id,
    severity, latitude, longitude, address, is_anonymous,
  } = req.body;

  const issueId    = uuidv4();
  const slaHours   = SLA_HOURS[severity] || 72;
  const slaDeadline = new Date(Date.now() + slaHours * 3600_000);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert the issue row
    const issue = await issuesService.createIssue(client, {
      id:             issueId,
      user_id:        req.user.id,
      title,
      description,
      category_id,
      subcategory_id,
      severity,
      latitude:       latitude  ? parseFloat(latitude)  : null,
      longitude:      longitude ? parseFloat(longitude) : null,
      address:        address || null,
      is_anonymous:   is_anonymous === true || is_anonymous === 'true',
      sla_hours:      slaHours,
      sla_deadline:   slaDeadline,
    });

    // 2. Upload media files (skip gracefully if Cloudinary not configured)
    const cloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name';

    if (req.files?.length && cloudinaryConfigured) {
      for (const file of req.files) {
        const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
        try {
          const result = await uploadToCloudinary(file.buffer, {
            folder:        'civicsense/issues',
            resource_type: mediaType,
            public_id:     `issue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          });
          await issuesService.insertIssueMedia(client, {
            issueId: issue.id,
            url:     result.secure_url,
            publicId: result.public_id,
            type:    mediaType,
          });
        } catch (uploadErr) {
          console.warn('Media upload failed, skipping file:', file.originalname, uploadErr.message);
        }
      }
    } else if (req.files?.length && !cloudinaryConfigured) {
      console.warn(`Cloudinary not configured — skipping ${req.files.length} file(s)`);
    }

    // 3. Record initial status history
    await issuesService.insertStatusHistory(client, {
      issueId:   issue.id,
      oldStatus: null,
      newStatus: 'reported',
      updatedBy: req.user.id,
      comment:   'Issue reported',
      isPublic:  true,
    });

    await client.query('COMMIT');

    // Emit real-time event
    const io = req.app.get('io');
    if (io) io.emit('new_issue', { issue });

    res.status(201).json({ issue });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createIssue:', err);
    res.status(500).json({ error: 'Failed to create issue' });
  } finally {
    client.release();
  }
}

// ────────────────────────────────────────────────────────────────────────────
// PATCH /api/issues/:id/status   (admin / department_staff only)
// ────────────────────────────────────────────────────────────────────────────
async function updateIssueStatus(req, res) {
  const { status, comment, rejection_reason } = req.body;
  const { id: issueId } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch current issue
    const current = await issuesService.getIssueById(issueId);
    if (!current) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Update status
    const updated = await issuesService.updateIssueStatus(client, issueId, {
      status,
      rejection_reason: rejection_reason || null,
    });

    // Record history
    await issuesService.insertStatusHistory(client, {
      issueId,
      oldStatus: current.status,
      newStatus: status,
      updatedBy: req.user.id,
      comment:   comment || null,
    });

    // Notify followers
    await issuesService.notifyFollowers(client, {
      issueId,
      issueTitle: current.title,
      newStatus:  status,
    });

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) {
      io.to(`issue_${issueId}`).emit('issue_status_updated', {
        issueId, status, updatedBy: req.user.name,
      });
    }

    res.json({ issue: updated });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('updateIssueStatus:', err.message);
    res.status(500).json({ error: 'Failed to update status' });
  } finally {
    client.release();
  }
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/issues/:id/history
// ────────────────────────────────────────────────────────────────────────────
async function getIssueHistory(req, res) {
  try {
    const history = await issuesService.getStatusHistory(req.params.id);
    res.json({ history });
  } catch (err) {
    console.error('getIssueHistory:', err.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
}

module.exports = {
  getCategories,
  listIssues,
  getIssue,
  createIssue,
  updateIssueStatus,
  getIssueHistory,
};
