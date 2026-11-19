require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const pool = require('./db/pool');
const prisma = require('./db/prisma');
const { apiLimiter } = require('./middleware/rateLimiter');
const { cleanupTempUploads } = require('./middleware/upload');
const setupSocket = require('./socket/index');

const authRoutes = require('./routes/auth');
const issuesRoutes = require('./routes/issues');
const commentsRoutes = require('./routes/comments');
const votesRoutes = require('./routes/votes');
const usersRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const reviewsRoutes = require('./routes/reviews');
const anonymousRoutes = require('./routes/anonymous');
const { closeUnansweredAnonymousReports } = require('./services/issues.service');

const app = express();
const server = http.createServer(app);

// Trust Render's reverse proxy so express-rate-limit can read the real client IP
app.set('trust proxy', 1);

// Credentialed requests are only accepted from origins listed here. Add preview
// deployments explicitly through CORS_EXTRA_ORIGINS (comma separated).
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  ...(process.env.CORS_EXTRA_ORIGINS || '').split(','),
  'http://localhost:3000',
].map((origin) => origin?.trim().replace(/\/$/, '')).filter(Boolean);

const checkOrigin = (origin, callback) => {
  // Allow requests with no origin (mobile apps, curl, etc.)
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  callback(new Error('Not allowed by CORS'));
};

const corsOptions = { origin: checkOrigin, credentials: true };

const io = new Server(server, {
  cors: {
    origin: checkOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

setupSocket(io);
app.set('io', io);

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use(cleanupTempUploads);

// Rate limiting
app.use('/api/', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/issues', issuesRoutes);
app.use('/api/issues/:issueId/comments', commentsRoutes);
app.use('/api/issues/:issueId/reviews', reviewsRoutes);
app.use('/api/issues/:issueId', votesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/anonymous', anonymousRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
  } catch (err) {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  console.error(err);
  if (err.name === 'MulterError' || err.message?.includes('Invalid file type')) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 CivicSense API running on port ${PORT}`);
  console.log(`📡 Socket.io listening`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Runs at startup too, so a sleeping free-tier instance catches up when it wakes.
  const closeUnanswered = () => closeUnansweredAnonymousReports().catch((err) => console.error('Auto-close failed:', err.message));
  closeUnanswered();
  setInterval(closeUnanswered, 60 * 60 * 1000).unref();
});
