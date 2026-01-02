import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { appendFileSync } from 'fs';
import { requestLogger } from './middleware/requestLogger.js';
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/authRoutes.js';
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
import categoryRoutes from './routes/categoryRoutes.js';
import representativeRoutes from './routes/representativeRoutes.js';
import healthRoutes from './routes/healthRoutes.js';

export type CreateAppOptions = {
  disableRateLimiting?: boolean;
};

// Builds an Express app without binding a listener; useful for tests.
export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://echo-ng.com',
    'https://tryecho.online'
  ];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);
  app.use((req, res, next) => {
    appendFileSync('server.log', `[DEBUG] Incoming request: ${req.method} ${req.url}\n`);
    next();
  });

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
    skipSuccessfulRequests: true
  });

  const createLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Too many create/update operations. Please slow down.'
  });

  const applyCreateLimiter = (req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
      return createLimiter(req, res, next);
    }
    return next();
  };

  if (!options.disableRateLimiting) {
    app.use(limiter);
    app.use('/api/users/register', authLimiter);
    app.use('/api/users/login', authLimiter);
    app.use('/api/users/google', authLimiter);
    app.use('/api/users/forgot-password', authLimiter);
    app.use('/api/users/reset-password', authLimiter);
    app.use('/api/users/verify-email', authLimiter);
    app.use('/api/users/organization-waitlist', authLimiter);
    app.use('/api/auth/google', authLimiter);
  }

  app.use(helmet());
  app.use('/health', healthRoutes);

  const writeLimiter = options.disableRateLimiting ? [] : [applyCreateLimiter];

  app.use('/api/users', (req, res, next) => {
    console.log(`[DEBUG] Request to /api/users: ${req.method} ${req.url}`);
    next();
  }, ...writeLimiter, userRoutes);
  app.use('/api/auth', ...writeLimiter, authRoutes);
  app.use('/api/pings', ...writeLimiter, pingRoutes);
  app.use('/api/pings/:pingId/waves', ...writeLimiter, waveRoutes);
  app.use('/api/waves', waveStandaloneRoutes);
  app.use('/api/pings/:pingId/comments', ...writeLimiter, pingCommentRouter);
  app.use('/api/waves/:waveId/comments', ...writeLimiter, waveCommentRouter);
  app.use('/api/pings/:pingId/surge', ...writeLimiter, pingSurgeRouter);
  app.use('/api/waves/:waveId/surge', ...writeLimiter, waveSurgeRouter);
  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  app.use('/api/pings/:pingId/official-response', ...writeLimiter, officialResponseRoutes);
  app.use('/api/admin', ...writeLimiter, adminRoutes);
  app.use('/api/announcements', ...writeLimiter, announcementRoutes);
  app.use('/api/representatives', ...writeLimiter, representativeRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/categories', ...writeLimiter, categoryRoutes);

  app.use(errorHandler);
  return app;
}

export default createApp;
