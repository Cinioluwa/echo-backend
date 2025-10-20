// src/config/db.ts
import { PrismaClient } from '@prisma/client';
import logger from './logger.js';

// Create a single, reusable Prisma Client instance with logging
const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

// Log Prisma warnings
prisma.$on('warn' as any, (e: any) => {
  logger.warn('Prisma warning', { message: e.message, target: e.target });
});

// Log Prisma errors
prisma.$on('error' as any, (e: any) => {
  logger.error('Prisma error', { message: e.message, target: e.target });
});

// Test database connection on startup
prisma.$connect()
  .then(() => {
    logger.info('✅ Database connected successfully');
  })
  .catch((error) => {
    logger.error('❌ Database connection failed', { error: error.message });
    process.exit(1); // Exit if database connection fails
  });

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