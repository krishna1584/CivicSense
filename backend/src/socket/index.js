const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const setupSocket = (io) => {
  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      
      if (!token) {
        const cookieHeader = socket.handshake.headers?.cookie;
        if (cookieHeader) {
          const cookies = {};
          cookieHeader.split(';').forEach(c => {
            const parts = c.trim().split('=');
            if (parts.length === 2) {
              cookies[parts[0]] = parts[1];
            }
          });
          token = cookies['accessToken'];
        }
      }

      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await pool.query('SELECT id, name, role FROM users WHERE id = $1', [decoded.userId]);
        if (result.rows[0]) socket.user = result.rows[0];
      }
    } catch (_) {}
    next();
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id} | User: ${socket.user?.name || 'guest'}`);

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

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  return io;
};

module.exports = setupSocket;
