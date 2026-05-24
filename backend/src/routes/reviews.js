const express = require('express');
const pool = require('../db/pool');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true }); // inherit :issueId param

// Helper function to dynamically recalculate and update a user's trust score based on admin ratings
async function updateUserTrustScore(client, targetUserId) {
  const reviewsRes = await client.query(
    'SELECT rating FROM issue_reviews WHERE target_user_id = $1 AND is_hidden = FALSE',
    [targetUserId]
  );

  let trustScore = 50; // Base score
  for (const row of reviewsRes.rows) {
    if (row.rating === 5) trustScore += 15;
    else if (row.rating === 4) trustScore += 8;
    else if (row.rating === 3) trustScore += 0;
    else if (row.rating === 2) trustScore -= 10;
    else if (row.rating === 1) trustScore -= 20;
  }

  // Clamp trust score between 0 and 100
  trustScore = Math.max(0, Math.min(100, trustScore));

  await client.query(
    'UPDATE users SET trust_score = $1, updated_at = NOW() WHERE id = $2',
    [trustScore, targetUserId]
  );
}

// ─── POST /api/issues/:issueId/reviews ──────────────────────────────────────
// Submit a satisfaction review (eligibility: resolved issue + reporter/upvoter/follower)
// Admin reviews target the reporting citizen, while citizens review the resolution itself.
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

    const isReviewerAdmin = ['admin', 'department_staff'].includes(req.user.role);
    const targetUserId = isReviewerAdmin ? issueRes.rows[0].user_id : null;

    // Insert review (UNIQUE constraint prevents duplicate per user per issue)
    const reviewRes = await client.query(
      `INSERT INTO issue_reviews (issue_id, user_id, rating, comment, target_user_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (issue_id, user_id) DO UPDATE
         SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, target_user_id = EXCLUDED.target_user_id, created_at = NOW()
       RETURNING *`,
      [issueId, userId, Math.round(rating), comment?.trim() || null, targetUserId]
    );

    // Recompute avg_rating and review_count on the issue (filtering for citizen satisfaction reviews only)
    await client.query(`
      UPDATE issues
      SET
        avg_rating   = (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM issue_reviews WHERE issue_id = $1 AND is_hidden = FALSE AND target_user_id IS NULL),
        review_count = (SELECT COUNT(*) FROM issue_reviews WHERE issue_id = $1 AND is_hidden = FALSE AND target_user_id IS NULL)
      WHERE id = $1
    `, [issueId]);

    // Recalculate target citizen's trust score if this is an admin review
    if (targetUserId) {
      await updateUserTrustScore(client, targetUserId);
    }

    await client.query('COMMIT');

    // Fetch reviewer name to return enriched data
    const enriched = await pool.query(
      `SELECT r.*, u.name AS reviewer_name, u.avatar_url AS reviewer_avatar,
              tu.name AS target_user_name
       FROM issue_reviews r 
       JOIN users u ON r.user_id = u.id 
       LEFT JOIN users tu ON r.target_user_id = tu.id
       WHERE r.id = $1`,
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
// Fetch all visible reviews for an issue, with reviewer info and target info
router.get('/', optionalAuth, async (req, res) => {
  const { issueId } = req.params;
  try {
    const [reviewsRes, summaryRes] = await Promise.all([
      pool.query(`
        SELECT r.id, r.rating, r.comment, r.created_at, r.is_hidden, r.target_user_id,
               u.id AS reviewer_id, u.name AS reviewer_name, u.avatar_url AS reviewer_avatar,
               u.trust_score AS reviewer_trust,
               tu.name AS target_user_name
        FROM issue_reviews r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN users tu ON r.target_user_id = tu.id
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
        FROM issue_reviews WHERE issue_id = $1 AND is_hidden = FALSE AND target_user_id IS NULL
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

    // Re-sync issue avg_rating and review_count (citizen satisfaction reviews only)
    await pool.query(`
      UPDATE issues
      SET
        avg_rating   = (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM issue_reviews WHERE issue_id = $1 AND is_hidden = FALSE AND target_user_id IS NULL),
        review_count = (SELECT COUNT(*) FROM issue_reviews WHERE issue_id = $1 AND is_hidden = FALSE AND target_user_id IS NULL)
      WHERE id = $1
    `, [result.rows[0].issue_id]);

    // If it is an admin review, we must also update the citizen's trust score!
    if (result.rows[0].target_user_id) {
      await updateUserTrustScore(pool, result.rows[0].target_user_id);
    }

    res.json({ review: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle review visibility.' });
  }
});

module.exports = router;
