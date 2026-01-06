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
    const redisClient = await connectRedis();
    await connectDatabase();
    const app = createApp({ redisClient });
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