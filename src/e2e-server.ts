import { PrismaClient } from '@prisma/test-client';

const PORT = process.env.PORT || 3000;
const enableE2eBootstrapDebug = process.env.DEBUG_E2E_SERVER === 'true';

if (enableE2eBootstrapDebug) {
    console.log('E2E Server starting...');
}

const startServer = async () => {
    try {
        // Initialize test client
        const prisma = new PrismaClient({
            datasources: {
                testDb: {
                    url: process.env.DATABASE_URL
                }
            }
        });

        // Set global test client BEFORE importing app/db
        (globalThis as any).__testPrismaClient = prisma;

        // Dynamic imports to ensure global is set first
        const { createApp } = await import('./app.js');
        const { default: db } = await import('./config/db.js');
        const { default: logger } = await import('./config/logger.js');

        const app = createApp({ disableRateLimiting: true });

        await db.$connect();
        logger.info('Database connected for E2E tests');

        app.listen(PORT, () => {
            logger.info(`E2E Test Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start E2E server', error);
        process.exit(1);
    }
};

startServer();
