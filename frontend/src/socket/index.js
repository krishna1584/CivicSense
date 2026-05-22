const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const setupSocket = (io) => {
  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const getCookie = (cookieStr, key) => {
        if (!cookieStr) return null;
        const match = cookieStr.match(new RegExp('(^|;)\\s*' + key + '\\s*=\\s*([^;]+)'));
        return match ? match[2] : null;
      };
      const token = socket.handshake.auth?.token || 
                    socket.handshake.headers?.authorization?.split(' ')[1] ||
                    getCookie(socket.handshake.headers?.cookie, 'accessToken');
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await pool.query('SELECT id, name, role FROM users WHERE id = $1', [decoded.userId]);
        if (result.rows[0]) socket.user = result.rows[0];
      }
    } catch (_) {}
    next();
  });

  io.on('connection', (socket) => {
    // Join issue room for real-time updates
    socket.on('join_issue', (issueId) => {
      socket.join(`issue_${issueId}`);
    });

    socket.on('leave_issue', (issueId) => {
      socket.leave(`issue_${issueId}`);
    });

    // Join personal notification room
    if (socket.user) {
      socket.join(`user_${socket.user.id}`);
    }

    // Admin joins live dashboard room
    if (socket.user?.role === 'admin') {
      socket.join('admin_room');
    }

    socket.on('disconnect', () => {});
  });

  return io;
};

module.exports = setupSocket;
