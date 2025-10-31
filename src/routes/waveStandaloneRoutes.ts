import { Router } from 'express';
import { getWaveById } from '../controllers/waveController.js';
import { validate } from '../middleware/validationMiddleware.js';
import { waveIdParamSchema } from '../schemas/waveSchemas.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';

const waveStandaloneRouter = Router();

// GET /api/waves/:id - Standalone route, now requires authentication
waveStandaloneRouter.get('/:id', authMiddleware, organizationMiddleware, validate(waveIdParamSchema), getWaveById);

export default waveStandaloneRouter;
