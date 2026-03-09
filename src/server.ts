// src/server.ts
import 'dotenv/config';
import { setDefaultResultOrder } from 'node:dns';
import { createApp } from './app.js';
import { env } from './config/env.js';
import logger from './config/logger.js';
import { connectDatabase } from './config/db.js';
import { connectRedis } from './config/redis.js';

// Prefer IPv4 over IPv6 for outbound connections (helps with SMTP providers in some hosted environments).
try {
  setDefaultResultOrder('ipv4first');
} catch {
  // Ignore if not supported by the current Node runtime.
}

const PORT = env.PORT;

(async () => {
  try {
    await connectDatabase();

    // Connect Redis before creating the app. RedisStore fires loadIncrementScript
    // immediately in its constructor — passing an unconnected cluster client would
    // cause an unhandled rejection that crashes the process under Node 15+.
    const redisClient = await connectRedis();
    if (redisClient) {
      logger.info('Redis connected — rate-limit stores will use Redis');
    } else {
      logger.warn('Redis unavailable — falling back to in-memory rate-limit stores');
    }

    const app = createApp({ redisClient: redisClient ?? null });
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server is listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.debug('Server address', { address: server.address() });
    });
  } catch (err) {
    logger.error('Failed to start server during startup', { error: err });
    process.exit(1);
  }
})();