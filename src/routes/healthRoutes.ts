import { Router, Request, Response } from 'express';
import prisma from '../config/db.js';
import logger from '../config/logger.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
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

export default router;
