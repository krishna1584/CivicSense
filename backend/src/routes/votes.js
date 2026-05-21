const express = require('express');
const pool = require('../db/pool');
const { auth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// POST /api/issues/:issueId/votes
router.post('/', auth, async (req, res) => {
  const { vote_type } = req.body;
  if (!['upvote', 'downvote'].includes(vote_type)) return res.status(400).json({ error: 'Invalid vote type' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT * FROM votes WHERE issue_id = $1 AND user_id = $2',
      [req.params.issueId, req.user.id]
    );

    let action = 'voted';
    if (existing.rows[0]) {
      if (existing.rows[0].vote_type === vote_type) {
        // Remove vote (toggle off)
        await client.query('DELETE FROM votes WHERE id = $1', [existing.rows[0].id]);
        const col = vote_type === 'upvote' ? 'upvote_count' : 'downvote_count';
        await client.query(`UPDATE issues SET ${col} = GREATEST(${col} - 1, 0) WHERE id = $1`, [req.params.issueId]);
        action = 'removed';
      } else {
        // Change vote type
        await client.query('UPDATE votes SET vote_type = $1 WHERE id = $2', [vote_type, existing.rows[0].id]);
        if (vote_type === 'upvote') {
          await client.query('UPDATE issues SET upvote_count = upvote_count + 1, downvote_count = GREATEST(downvote_count - 1, 0) WHERE id = $1', [req.params.issueId]);
        } else {
          await client.query('UPDATE issues SET downvote_count = downvote_count + 1, upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = $1', [req.params.issueId]);
        }
        action = 'changed';
      }
    } else {
      const voteId = require('crypto').randomUUID();
      await client.query('INSERT INTO votes (id, issue_id, user_id, vote_type) VALUES ($1, $2, $3, $4)', [voteId, req.params.issueId, req.user.id, vote_type]);
      const col = vote_type === 'upvote' ? 'upvote_count' : 'downvote_count';
      await client.query(`UPDATE issues SET ${col} = ${col} + 1 WHERE id = $1`, [req.params.issueId]);
    }

    const issueRes = await client.query('SELECT upvote_count, downvote_count FROM issues WHERE id = $1', [req.params.issueId]);
    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) io.to(`issue_${req.params.issueId}`).emit('new_upvote', { issueId: req.params.issueId, ...issueRes.rows[0] });

    res.json({ action, ...issueRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to process vote' });
  } finally {
    client.release();
  }
});

// POST /api/issues/:issueId/follow
router.post('/follow', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM follows WHERE issue_id = $1 AND user_id = $2', [req.params.issueId, req.user.id]);

    let following;
    if (existing.rows[0]) {
      await client.query('DELETE FROM follows WHERE id = $1', [existing.rows[0].id]);
      await client.query('UPDATE issues SET follow_count = GREATEST(follow_count - 1, 0) WHERE id = $1', [req.params.issueId]);
      following = false;
    } else {
      const followId = require('crypto').randomUUID();
      await client.query('INSERT INTO follows (id, issue_id, user_id) VALUES ($1, $2, $3)', [followId, req.params.issueId, req.user.id]);
      await client.query('UPDATE issues SET follow_count = follow_count + 1 WHERE id = $1', [req.params.issueId]);
      following = true;
    }

    const issueRes = await client.query('SELECT follow_count FROM issues WHERE id = $1', [req.params.issueId]);
    await client.query('COMMIT');
    res.json({ following, follow_count: issueRes.rows[0].follow_count });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to process follow' });
  } finally {
    client.release();
  }
});

module.exports = router;
