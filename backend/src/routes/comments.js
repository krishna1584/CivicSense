const express = require('express');
const pool = require('../db/pool');
const { auth, optionalAuth } = require('../middleware/auth');
const { validate, createCommentSchema } = require('../middleware/validate');

const router = express.Router({ mergeParams: true });

// GET /api/issues/:issueId/comments
router.get('/', optionalAuth, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const result = await pool.query(`
      SELECT c.*, u.name AS author_name, u.avatar_url AS author_avatar, u.role AS author_role
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.issue_id = $1 AND c.is_internal = FALSE AND c.parent_id IS NULL
      ORDER BY c.created_at ASC
      LIMIT $2 OFFSET $3
    `, [req.params.issueId, parseInt(limit), offset]);

    res.json({ comments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/issues/:issueId/comments
router.post('/', auth, validate(createCommentSchema), async (req, res) => {
  const { content, parent_id, is_internal } = req.body;
  const isAdmin = ['admin', 'department_staff'].includes(req.user.role);
  const isAdminComment = isAdmin;
  const internal = is_internal && isAdmin ? true : false;

  try {
    const issueResult = await pool.query('SELECT id, title FROM issues WHERE id = $1', [req.params.issueId]);
    if (!issueResult.rows[0]) return res.status(404).json({ error: 'Issue not found' });

    const result = await pool.query(`
      INSERT INTO comments (issue_id, user_id, content, is_admin_comment, is_internal, parent_id)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [req.params.issueId, req.user.id, content, isAdminComment, internal, parent_id || null]);

    await pool.query('UPDATE issues SET comment_count = comment_count + 1, updated_at = NOW() WHERE id = $1', [req.params.issueId]);

    const comment = { ...result.rows[0], author_name: req.user.name, author_role: req.user.role };

    // Notify followers (except commenter)
    const followers = await pool.query(
      'SELECT user_id FROM follows WHERE issue_id = $1 AND user_id != $2',
      [req.params.issueId, req.user.id]
    );
    for (const f of followers.rows) {
      await pool.query(
        'INSERT INTO notifications (user_id, issue_id, type, message) VALUES ($1, $2, $3, $4)',
        [f.user_id, req.params.issueId, 'new_comment', `${req.user.name} commented on an issue you follow`]
      );
    }

    const io = req.app.get('io');
    if (io) io.to(`issue_${req.params.issueId}`).emit('new_comment', { comment });

    res.status(201).json({ comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// DELETE /api/issues/:issueId/comments/:commentId
router.delete('/:commentId', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM comments WHERE id = $1 AND issue_id = $2', [req.params.commentId, req.params.issueId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Comment not found' });

    const comment = result.rows[0];
    const isOwner = comment.user_id === req.user.id;
    const isAdmin = ['admin'].includes(req.user.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Cannot delete this comment' });

    await pool.query('DELETE FROM comments WHERE id = $1', [req.params.commentId]);
    await pool.query('UPDATE issues SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = $1', [req.params.issueId]);

    res.json({ message: 'Comment deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;
