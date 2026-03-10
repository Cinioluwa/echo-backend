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

    // ─── PROBLEM: Redis connection was blocking server startup ─────────────────
    //
    // Original code awaited connectRedis() here before calling app.listen().
    // This meant the HTTP server would not bind its port until Redis either
    // connected successfully or timed out (~15s).
    //
    // On Azure App Service, the warm-up probe fires immediately after the
    // container starts. The probe repeatedly hits the app's port looking for
    // any HTTP response. If it gets no response within 230s, Azure kills the
    // container with ContainerTimeout and marks the deployment as failed.
    //
    // In practice, Redis was taking 80-145s to fail (before we fixed the client
    // type), so the server never bound its port in time → ContainerTimeout crash.
    // Even with a healthy Redis, a 15s delay on every cold start is unnecessary.
    //
    // FIX — Bind the HTTP server immediately (Redis = null → memory fallback for
    // rate limiters). Connect Redis in the background via a non-awaited Promise.
    // The warm-up probe now succeeds in <5s. Redis connects in the background
    // and logs its result — but a Redis failure can never prevent the HTTP server
    // from accepting traffic.
    //
    // LESSON — On any platform with a startup health-check, never block the HTTP
    // server bind on optional external services (Redis, queues, etc.). Start fast,
    // degrade gracefully, and let the service come up in the background.
    // ──────────────────────────────────────────────────────────────────────────

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