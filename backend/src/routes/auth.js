const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate, registerSchema, loginSchema } = require('../middleware/validate');
const { auth } = require('../middleware/auth');

const router = express.Router();

const signTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });
  return { accessToken, refreshToken };
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
};

// POST /api/auth/register
router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows[0]) return res.status(409).json({ error: 'Email already registered' });

    const id = uuidv4();
    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, trust_score, created_at',
      [id, name, email, password_hash]
    );
    const user = result.rows[0];
    const { accessToken, refreshToken } = signTokens(user.id);

    const refreshId = uuidv4();
    await pool.query(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'7 days\')',
      [refreshId, user.id, refreshToken]
    );

    res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.status(201).json({ user, accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!user.is_active) return res.status(403).json({ error: 'Account deactivated' });

    const { accessToken, refreshToken } = signTokens(user.id);
    const refreshId = uuidv4();
    await pool.query(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'7 days\')',
      [refreshId, user.id, refreshToken]
    );

    res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, trust_score: user.trust_score }, accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'Refresh token required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const stored = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    if (!stored.rows[0]) return res.status(401).json({ error: 'Invalid refresh token' });

    // Rotate refresh token
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
    const { accessToken, refreshToken: newRefresh } = signTokens(decoded.userId);
    const refreshId = uuidv4();
    await pool.query(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'7 days\')',
      [refreshId, decoded.userId, newRefresh]
    );

    res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', newRefresh, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ accessToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [token]).catch(() => {});
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
