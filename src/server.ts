// src/server.ts
import 'dotenv/config';
import { env } from './config/env.js'; // Validate env vars at startup
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import logger from './config/logger.js';
import { requestLogger } from './middleware/requestLogger.js';
import userRoutes from './routes/userRoutes.js'; 
import errorHandler from './middleware/errorHandler.js';
import pingRoutes from './routes/pingRoutes.js';
import waveRoutes from './routes/waveRoutes.js';
import waveStandaloneRoutes from './routes/waveStandaloneRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { pingCommentRouter, waveCommentRouter } from './routes/commentRoutes.js';
import { pingSurgeRouter, waveSurgeRouter } from './routes/surgeRoutes.js';
import officialResponseRoutes from './routes/officialResponseRoutes.js';
import announcementRoutes from './routes/announcementRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import helmet from 'helmet';
import { connectDatabase } from './config/db.js';
import representativeRoutes from './routes/representativeRoutes.js';

const app = express();
const PORT = env.PORT;

app.use(cors());  // Enable CORS for all routes
//Will need to configure CORS more specifically in production

// Request logging middleware (should be early in the chain)
// Middleware to parse JSON bodies with a sane size limit in dev
app.use(express.json({ limit: '1mb' }));

// Request logging middleware (should run after body parsing so bodies are available)
app.use(requestLogger);

// General rate limiter for all routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Reduced from 100 for better security
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes.'
});

app.use(helmet()); // Set security-related HTTP headers

// Strict rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 login/register attempts
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
  skipSuccessfulRequests: true, // Don't count successful logins against the limit
});

// Rate limiter for content creation (POST/PATCH/DELETE)
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 create/update operations per 15 min
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many create/update operations. Please slow down.'
});


app.use(limiter); // Apply general rate limiter to all routes

// Apply auth-specific rate limiter to auth routes
app.use('/api/users/register', authLimiter);
app.use('/api/users/login', authLimiter);

// Apply create limiter to write operations (POST, PATCH, DELETE)
const applyCreateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    return createLimiter(req, res, next);
  }
  next();
};

app.use('/api/users', userRoutes);
//POST /api/users/register - Register a new user (organization assigned during registration)
//POST /api/users/login - Login a user (returns JWT with organizationId)
//GET /api/users/me - Get current user profile (organization-scoped)
//PATCH /api/users/me - Update logged-in user's profile (firstName/lastName) - organization-scoped
//DELETE /api/users/me - Delete a user account (organization-scoped)
//GET /api/users/me/surges - Get all surges (likes) by current user (organization-scoped, with pagination)
//GET /api/users/me/comments - Get all comments by current user (organization-scoped, with pagination)

app.use('/api/pings', applyCreateLimiter, pingRoutes);
//GET /api/pings - Get all pings in user's organization (with pagination: ?page=1&limit=20 and optional filters: ?category=GENERAL&status=POSTED)
//POST /api/pings - Create a new ping (requires organization membership)
//GET /api/pings/search - Search pings by hashtag (?hashtag=exam) or text query (?q=calculus) within organization
//GET /api/pings/me - Get current user's pings within organization (with pagination: ?page=1&limit=20)
//GET /api/pings/:id - Get a specific ping by id (organization-scoped)
//PATCH /api/pings/:id - Update a ping (organization-scoped)
//DELETE /api/pings/:id - Delete a ping (organization-scoped)

// Wave routes (nested under pings)
app.use('/api/pings/:pingId/waves', applyCreateLimiter, waveRoutes);
//GET /api/pings/:pingId/waves - Get all waves for a ping within organization (with pagination: ?page=1&limit=20)
//POST /api/pings/:pingId/waves - Create a wave (solution) for a ping (requires organization membership)
//GET /api/waves/:id - Get a specific wave by id within organization (increments viewCount)

// Standalone wave route
app.use('/api/waves', waveStandaloneRoutes);

// Comment routes
app.use('/api/pings/:pingId/comments', applyCreateLimiter, pingCommentRouter);
//GET /api/pings/:pingId/comments - Get all comments for a ping within organization
//POST /api/pings/:pingId/comments - Create a comment on a ping (requires organization membership)
app.use('/api/waves/:waveId/comments', applyCreateLimiter, waveCommentRouter);
//GET /api/waves/:waveId/comments - Get all comments for a wave within organization
//POST /api/waves/:waveId/comments - Create a comment on a wave (requires organization membership)

// Surge routes
app.use('/api/pings/:pingId/surge', applyCreateLimiter, pingSurgeRouter);
//POST /api/pings/:pingId/surge - Toggle surge (like/unlike) on a ping within organization (requires organization membership)
app.use('/api/waves/:waveId/surge', applyCreateLimiter, waveSurgeRouter);
//POST /api/waves/:waveId/surge - Toggle surge (like/unlike) on a wave within organization (requires organization membership)

// Simple healthcheck endpoint
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Official Response routes
app.use('/api/pings/:pingId/official-response', applyCreateLimiter, officialResponseRoutes);
//GET /api/pings/:pingId/official-response - Get official response for a ping within organization
//POST /api/pings/:pingId/official-response - Create/update official response for a ping (representative only, organization-scoped)

// Admin routes placed after global security/rate-limit middlewares to ensure they are protected
app.use('/api/admin', adminRoutes);

app.use('/api/announcements', announcementRoutes);
//GET /api/announcements - Get all announcements for user's organization (with optional filters: ?college=&hall=&level=&gender=)
//POST /api/admin/announcements - Create a new announcement (admin only, organization-scoped)
app.use('/api/representatives', representativeRoutes);
// Public routes (Soundboard/Stream)
app.use('/api/public', publicRoutes);

// Centralized error handler (should be the last middleware)
app.use(errorHandler);

// Ensure DB is connected before starting the server. The db module exports a connect function that will
// attempt to connect (and log) but will not directly exit the process. This lets the server handle failure
// modes more gracefully in tests and container orchestrators.

(async () => {
  try {
    await connectDatabase();
    const server = app.listen(PORT, '127.0.0.1', () => {
      logger.info(`🚀 Server is listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('Server address:', server.address());
    });
  } catch (err) {
    logger.error('Failed to start server due to DB connection error', { error: err });
    process.exit(1);
  }
})();