const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const auth = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query('SELECT id, name, email, role, trust_score, avatar_url, is_verified, is_active FROM users WHERE id = $1', [decoded.userId]);

    if (!result.rows[0]) return res.status(401).json({ error: 'User not found' });
    if (!result.rows[0].is_active) return res.status(403).json({ error: 'Account is deactivated' });

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
  next();
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken || req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await pool.query('SELECT id, name, email, role, trust_score, avatar_url, is_verified FROM users WHERE id = $1', [decoded.userId]);
      if (result.rows[0]) req.user = result.rows[0];
    }
  } catch (_) {}
  next();
};

module.exports = { auth, requireRole, optionalAuth };
