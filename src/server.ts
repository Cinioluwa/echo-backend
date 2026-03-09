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

    // Start the HTTP server immediately so health-check probes get a response.
    const app = createApp();
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server is listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.debug('Server address', { address: server.address() });
    });

    // Connect Redis in the background — never blocks or crashes the server.
    connectRedis()
      .then((redisClient) => {
        if (redisClient) {
          logger.info('Redis available — rate-limit stores upgraded');
        } else {
          logger.warn('Redis unavailable — using in-memory rate-limit stores');
        }
      })
      .catch((err) => {
        logger.error('Redis connection failed', { error: err instanceof Error ? err.message : String(err) });
      });
  } catch (err) {
    logger.error('Failed to start server during startup', { error: err });
    process.exit(1);
  }
})();