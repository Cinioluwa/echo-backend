// src/config/db.ts
import { PrismaClient } from '@prisma/client';
import logger from './logger.js';

// For testing: allow injecting a test Prisma client
declare global {
  var __testPrismaClient: PrismaClient | undefined;
}

console.log('Loading src/config/db.ts');
console.log('globalThis.__testPrismaClient is:', (globalThis as any).__testPrismaClient ? 'DEFINED' : 'UNDEFINED');
console.log('process.env.DATABASE_URL in db.ts:', process.env.DATABASE_URL);

// Create a single, reusable Prisma Client instance with logging
// Use test client if available (for testing), otherwise use production client
const prisma = globalThis.__testPrismaClient || new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

// Log Prisma warnings and errors are handled by the logger configuration above

// Export a helper to connect on demand instead of forcing a process exit at import time.
export const connectDatabase = async (options?: { retries?: number; initialDelayMs?: number; maxDelayMs?: number }) => {
  const retries = options?.retries ?? 5;
  const initialDelayMs = options?.initialDelayMs ?? 500;
  const maxDelayMs = options?.maxDelayMs ?? 3000;

  let attempt = 0;
  let delay = initialDelayMs;

  // Simple sleep helper
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  while (true) {
    try {
      await prisma.$connect();
      logger.info('✅ Database connected successfully');
      return;
    } catch (error: any) {
      attempt += 1;
      const message = error?.message || String(error);
      logger.warn('❌ Database connection attempt failed', { attempt, message });
      if (attempt > retries) {
        logger.error('Exceeded maximum DB connection retries. Giving up.');
        throw error;
      }
      await sleep(delay);
      delay = Math.min(maxDelayMs, Math.round(delay * 1.5));
    }
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;