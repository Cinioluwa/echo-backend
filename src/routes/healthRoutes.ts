import { Router, Request, Response } from 'express';
import prisma from '../config/db.js';
import logger from '../config/logger.js';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Deep health check (includes database)
 *     description: |
 *       Performs a comprehensive health check including database connectivity.
 *       Use this endpoint to verify that all critical services are operational.
 *       
 *       **No authentication required**
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: All services are healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                       example: healthy
 *       503:
 *         description: One or more services are unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: Error
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                       example: unhealthy
 */
// Deep health check (includes DB)
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.status(200).json({ 
      status: 'OK',
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy'
      }
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({ 
      status: 'Error',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unhealthy'
      }
    });
  }
});

/**
 * @openapi
 * /healthz:
 *   get:
 *     summary: Shallow health check (no database)
 *     description: |
 *       Quick health check that only verifies the application is running.
 *       Does not check database or other external services.
 *       
 *       **No authentication required**
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Application is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 */
// Shallow health check (no DB dependency)
router.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

export default router;
