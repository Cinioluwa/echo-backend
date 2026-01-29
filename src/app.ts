import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { appendFileSync } from 'node:fs';
import { RedisStore } from 'rate-limit-redis';
import { requestLogger } from './middleware/requestLogger.js';
import logger from './config/logger.js';
import { getRedisClient, isRedisConfigured } from './config/redis.js';
import { env } from './config/env.js';
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
import notificationRoutes from './routes/notificationRoutes.js';

import type { RedisClientType } from 'redis';
export type CreateAppOptions = {
  disableRateLimiting?: boolean;
  redisClient?: RedisClientType | null;
};

// Builds an Express app without binding a listener; useful for tests.
export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  // Railway (and most hosted platforms) sit behind a reverse proxy that sets X-Forwarded-For.
  // express-rate-limit validates this header and expects Express trust proxy to be enabled.
  // Default to enabled in production, with an escape hatch for local dev/testing.
  const trustProxyEnv = process.env.TRUST_PROXY;
  const shouldTrustProxy = trustProxyEnv
    ? trustProxyEnv === 'true' || trustProxyEnv === '1'
    : process.env.NODE_ENV === 'production';
  if (shouldTrustProxy) {
    app.set('trust proxy', 1);
  }

  const enableRequestFileLog = process.env.REQUEST_FILE_LOG === 'true';
  const enableRouteDebugLog = process.env.DEBUG_ROUTE_LOG === 'true';

  const defaultAllowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://echo-ng.com',
    'https://www.echo-ng.com',
    'https://tryecho.online',
    'https://webapp-echo.vercel.app'
  ];

  const allowedOrigins = env.ALLOWED_ORIGINS || defaultAllowedOrigins;

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
  if (enableRequestFileLog) {
    app.use((req, _res, next) => {
      appendFileSync('server.log', `[DEBUG] Incoming request: ${req.method} ${req.url}\n`);
      next();
    });
  }


  // Use the connected redisClient if provided, otherwise fallback to getRedisClient (legacy, for tests)
  const redisClient = !options.disableRateLimiting && isRedisConfigured()
    ? (options.redisClient ?? getRedisClient())
    : null;

  const globalStore = redisClient
    ? new RedisStore({
      prefix: 'rl:global:',
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    })
    : undefined;

  const authStore = redisClient
    ? new RedisStore({
      prefix: 'rl:auth:',
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    })
    : undefined;

  const writeStore = redisClient
    ? new RedisStore({
      prefix: 'rl:write:',
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    })
    : undefined;

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
    store: globalStore,
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
    skipSuccessfulRequests: true,
    store: authStore,
  });

  const createLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Too many create/update operations. Please slow down.',
    store: writeStore,
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
  app.use(healthRoutes);

  const writeLimiter = options.disableRateLimiting ? [] : [applyCreateLimiter];

  app.use('/api/users', (req, res, next) => {
    if (enableRouteDebugLog) {
      logger.debug('Route request', { prefix: '/api/users', method: req.method, url: req.url });
    }
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
  app.use('/api/pings/:pingId/official-response', ...writeLimiter, officialResponseRoutes);
  app.use('/api/admin', ...writeLimiter, adminRoutes);
  app.use('/api/announcements', ...writeLimiter, announcementRoutes);
  app.use('/api/notifications', ...writeLimiter, notificationRoutes);
  app.use('/api/representatives', ...writeLimiter, representativeRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/categories', ...writeLimiter, categoryRoutes);

  app.use(errorHandler);
  return app;
}

export default createApp;
