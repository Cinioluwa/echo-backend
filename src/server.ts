// src/server.ts
import 'dotenv/config';
import { createApp } from './app.js';
import { env } from './config/env.js';
import logger from './config/logger.js';
import { connectDatabase } from './config/db.js';

const app = createApp();
const PORT = env.PORT;

(async () => {
  try {
    await connectDatabase();
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server is listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.debug('Server address', { address: server.address() });
    });
  } catch (err) {
    logger.error('Failed to start server due to DB connection error', { error: err });
    process.exit(1);
  }
})();