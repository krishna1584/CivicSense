const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { loginIpLimiter, loginLimiter, registerLimiter, otpSendLimiter, otpVerifyLimiter } = require('../middleware/rateLimiter');
const { validate, registerSchema, loginSchema, sendOtpSchema, verifyOtpSchema, resetPasswordSchema } = require('../middleware/validate');
const { auth } = require('../middleware/auth');
const { sendOtpEmail, sendPasswordResetEmail } = require('../services/mail');
const { getSettings } = require('../services/settings.service');
const { issueOtp, checkOtp } = require('../services/otp.service');

const router = express.Router();

const signTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d', jwtid: uuidv4() });
  return { accessToken, refreshToken };
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
};

// Emails arrive lowercased from validation; LOWER() also matches accounts saved before that.
const FIND_BY_EMAIL = 'WHERE LOWER(email) = $1';

const startSession = async (res, userId) => {
  const { accessToken, refreshToken } = signTokens(userId);
  await pool.query(
    'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'7 days\')',
    [uuidv4(), userId, refreshToken]
  );
  res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
  return accessToken;
};

// POST /api/auth/register
router.post('/register', registerLimiter, validate(registerSchema), async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const { enableRegistration } = await getSettings();
    if (!enableRegistration) return res.status(403).json({ error: 'New registrations are currently closed.' });

    const exists = await pool.query(`SELECT id FROM users ${FIND_BY_EMAIL}`, [email]);
    if (exists.rows[0]) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (id, name, email, password_hash, is_verified) VALUES ($1, $2, $3, $4, FALSE) RETURNING id, name, email, role, trust_score, is_verified, created_at',
      [uuidv4(), name, email, password_hash]
    );
    const user = result.rows[0];

    const otp = await issueOtp(pool, user.id);
    sendOtpEmail(user.email, user.name, otp).catch(err => console.error('Failed to send OTP email:', err.message));

    const accessToken = await startSession(res, user.id);
    res.status(201).json({ user, accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', loginIpLimiter, loginLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(`SELECT * FROM users ${FIND_BY_EMAIL}`, [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid email or password' });

    if (!user.is_active) return res.status(403).json({ error: 'Account deactivated' });

    const accessToken = await startSession(res, user.id);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, trust_score: user.trust_score, avatar_url: user.avatar_url, address: user.address, is_verified: user.is_verified, created_at: user.created_at }, accessToken });
  } catch (err) {
    console.error('Login error:', err);
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
    const accessToken = await startSession(res, decoded.userId);
    res.json({ accessToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [token]).catch(() => {});
  // Browsers only remove a cookie when the clearing options match how it was set.
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/send-otp
router.post('/send-otp', otpSendLimiter, validate(sendOtpSchema), async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query(`SELECT id, name, is_verified FROM users ${FIND_BY_EMAIL}`, [email]);
    const user = result.rows[0];
    if (!user) {
      return res.json({ message: 'If this email is registered, an OTP has been sent.' });
    }
    if (user.is_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    const otp = await issueOtp(pool, user.id);
    sendOtpEmail(email, user.name, otp).catch(err => console.error('Failed to send OTP email:', err.message));

    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', otpVerifyLimiter, validate(verifyOtpSchema), async (req, res) => {
  const { email, code } = req.body;
  try {
    const result = await pool.query(`SELECT id, otp_code, otp_expires_at, is_verified FROM users ${FIND_BY_EMAIL}`, [email]);
    const user = result.rows[0];

    if (!user) return res.status(400).json({ error: 'Invalid or expired OTP' });
    if (user.is_verified) return res.status(400).json({ error: 'Email is already verified' });
    if (!(await checkOtp(pool, user, code))) return res.status(400).json({ error: 'Invalid or expired OTP' });

    const updatedResult = await pool.query(
      `UPDATE users SET is_verified = TRUE, otp_code = NULL, otp_expires_at = NULL, otp_attempts = 0 WHERE id = $1
       RETURNING id, name, email, role, trust_score, avatar_url, address, is_verified, created_at`,
      [user.id]
    );

    res.json({ message: 'Email verified successfully', user: updatedResult.rows[0] });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', otpSendLimiter, validate(sendOtpSchema), async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query(`SELECT id, name, is_active FROM users ${FIND_BY_EMAIL}`, [email]);
    const user = result.rows[0];
    if (user?.is_active) {
      const otp = await issueOtp(pool, user.id);
      sendPasswordResetEmail(email, user.name, otp).catch(err => console.error('Failed to send reset email:', err.message));
    }
    // Same answer either way, so this can't be used to discover registered emails.
    res.json({ message: 'If this email is registered, a reset code has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to send reset code' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', otpVerifyLimiter, validate(resetPasswordSchema), async (req, res) => {
  const { email, code, password } = req.body;
  try {
    const result = await pool.query(`SELECT id, otp_code, otp_expires_at FROM users ${FIND_BY_EMAIL}`, [email]);
    const user = result.rows[0];
    if (!(await checkOtp(pool, user, code))) return res.status(400).json({ error: 'Invalid or expired code' });

    const password_hash = await bcrypt.hash(password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, is_verified = TRUE, otp_code = NULL, otp_expires_at = NULL, otp_attempts = 0, updated_at = NOW() WHERE id = $2',
      [password_hash, user.id]
    );
    // End every existing session on this account.
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [user.id]);

    res.json({ message: 'Password updated. You can now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
