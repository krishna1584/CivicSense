const express = require('express');
const pool = require('../db/pool');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true }); // inherit :issueId param

// ─── POST /api/issues/:issueId/reviews ──────────────────────────────────────
// Submit a satisfaction review (eligibility: resolved issue + reporter/upvoter/follower)
router.post('/', auth, async (req, res) => {
  const { issueId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.user.id;

  if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be a number between 1 and 5.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Issue must exist and be resolved
    const issueRes = await client.query(
      'SELECT id, status, user_id, title FROM issues WHERE id = $1',
      [issueId]
    );
    if (!issueRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Issue not found.' });
    }
    if (issueRes.rows[0].status !== 'resolved') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Reviews can only be submitted for resolved issues.' });
    }

    // Any authenticated user can review as long as they haven't reviewed yet (unique constraint enforces once per user per issue)


    // Insert review (UNIQUE constraint prevents duplicate)
    const reviewRes = await client.query(
      `INSERT INTO issue_reviews (issue_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (issue_id, user_id) DO UPDATE
         SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = NOW()
       RETURNING *`,
      [issueId, userId, Math.round(rating), comment?.trim() || null]
    );

    // Recompute avg_rating and review_count on the issue
    await client.query(`
      UPDATE issues
      SET
        avg_rating   = (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM issue_reviews WHERE issue_id = $1 AND is_hidden = FALSE),
        review_count = (SELECT COUNT(*) FROM issue_reviews WHERE issue_id = $1 AND is_hidden = FALSE)
      WHERE id = $1
    `, [issueId]);

    await client.query('COMMIT');

    // Fetch reviewer name to return enriched data
    const enriched = await pool.query(
      `SELECT r.*, u.name AS reviewer_name, u.avatar_url AS reviewer_avatar
       FROM issue_reviews r JOIN users u ON r.user_id = u.id WHERE r.id = $1`,
      [reviewRes.rows[0].id]
    );

    res.status(201).json({ review: enriched.rows[0], message: 'Review submitted successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Review submit error:', err);
    res.status(500).json({ error: 'Failed to submit review.' });
  } finally {
    client.release();
  }
});

// ─── GET /api/issues/:issueId/reviews ────────────────────────────────────────
// Fetch all visible reviews for an issue, with reviewer info
router.get('/', optionalAuth, async (req, res) => {
  const { issueId } = req.params;
  try {
    const [reviewsRes, summaryRes] = await Promise.all([
      pool.query(`
        SELECT r.id, r.rating, r.comment, r.created_at, r.is_hidden,
               u.id AS reviewer_id, u.name AS reviewer_name, u.avatar_url AS reviewer_avatar,
               u.trust_score AS reviewer_trust
        FROM issue_reviews r
        JOIN users u ON r.user_id = u.id
        WHERE r.issue_id = $1 AND r.is_hidden = FALSE
        ORDER BY r.created_at DESC
      `, [issueId]),
      pool.query(`
        SELECT
          ROUND(AVG(rating)::NUMERIC, 2) AS avg_rating,
          COUNT(*) AS total_reviews,
          COUNT(*) FILTER (WHERE rating = 5) AS five_star,
          COUNT(*) FILTER (WHERE rating = 4) AS four_star,
          COUNT(*) FILTER (WHERE rating = 3) AS three_star,
          COUNT(*) FILTER (WHERE rating = 2) AS two_star,
          COUNT(*) FILTER (WHERE rating = 1) AS one_star
        FROM issue_reviews WHERE issue_id = $1 AND is_hidden = FALSE
      `, [issueId]),
    ]);

    // If user is logged in, check if they've reviewed and their eligibility
    let userReview = null;
    let userEligible = false;

    if (req.user) {
      const myReview = await pool.query('SELECT * FROM issue_reviews WHERE issue_id = $1 AND user_id = $2', [issueId, req.user.id]);
      userReview = myReview.rows[0] || null;
      userEligible = true;
    }

    res.json({
      reviews: reviewsRes.rows,
      summary: summaryRes.rows[0],
      userReview,
      userEligible,
    });
  } catch (err) {
    console.error('Review fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

// ─── PATCH /api/issues/:issueId/reviews/:reviewId/hide  (Admin only) ─────────
router.patch('/:reviewId/hide', auth, async (req, res) => {
  if (!['admin', 'department_staff'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Unauthorized.' });
  }
  const { reviewId } = req.params;
  try {
    const result = await pool.query(
      'UPDATE issue_reviews SET is_hidden = NOT is_hidden WHERE id = $1 RETURNING *',
      [reviewId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Review not found.' });

    // Re-sync issue avg_rating and review_count
    await pool.query(`
      UPDATE issues
      SET
        avg_rating   = (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM issue_reviews WHERE issue_id = $1 AND is_hidden = FALSE),
        review_count = (SELECT COUNT(*) FROM issue_reviews WHERE issue_id = $1 AND is_hidden = FALSE)
      WHERE id = $1
    `, [result.rows[0].issue_id]);

    res.json({ review: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle review visibility.' });
  }
});

// ─── GET /api/issues/reviews/me  ─────────────────────────────────────────────
// A separate handler for /api/reviews/me is registered at the top-level in index.js
// This is mounted as /api/issues/:issueId/reviews so that's handled separately

module.exports = router;
