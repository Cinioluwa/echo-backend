// src/server.ts
import 'dotenv/config';
import { setDefaultResultOrder } from 'node:dns';
import { createApp } from './app.js';
import { env } from './config/env.js';
import logger from './config/logger.js';
import { connectDatabase } from './config/db.js';
import { connectRedis, getConnectedClient } from './config/redis.js';

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

    // Start the server immediately — do NOT await Redis before binding the port.
    //
    // Previously we awaited connectRedis() here, which meant the server would
    // not start until Redis connected (or timed out). Azure App Service's warm-up
    // probe fires as soon as the container starts; if the server hasn't bound its
    // port within the probe window, the container is killed with ContainerTimeout.
    //
    // Instead, we pass null for redisClient initially (rate limiters fall back to
    // memory), kick off the Redis connection in the background, and the app starts
    // serving traffic right away. The Redis-backed rate limiters will take effect
    // on restart if needed, but in-memory fallback is perfectly acceptable.
    const app = createApp({ redisClient: null });
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server is listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.debug('Server address', { address: server.address() });
    });

    // Connect Redis in the background — failures are logged but never crash the process.
    connectRedis().then((redisClient) => {
      if (redisClient) {
        logger.info('Redis connected — rate-limit stores will use Redis on next deploy');
      } else {
        logger.warn('Redis unavailable — using in-memory rate-limit stores');
      }
    }).catch((err) => {
      logger.error('Unexpected error during background Redis connect', {
        error: err instanceof Error ? err.message : String(err),
      });
    });

  } catch (err) {
    logger.error('Failed to start server during startup', { error: err });
    process.exit(1);
  }
})();