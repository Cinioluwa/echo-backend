import { Router } from 'express';
import { getWaveById, updateWave, deleteWave } from '../controllers/waveController.js';
import { validate } from '../middleware/validationMiddleware.js';
import { waveIdParamSchema, updateWaveSchema } from '../schemas/waveSchemas.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';
import { cache } from '../middleware/cacheMiddleware.js';

const waveStandaloneRouter = Router();

// GET /api/waves/:id - Get a specific wave by ID - cached for 60s
waveStandaloneRouter.get('/:id', authMiddleware, organizationMiddleware, validate(waveIdParamSchema), cache(60), getWaveById);

// PATCH /api/waves/:id - Update a wave
waveStandaloneRouter.patch('/:id', authMiddleware, organizationMiddleware, validate(waveIdParamSchema), validate(updateWaveSchema), updateWave);

// DELETE /api/waves/:id - Delete a wave
waveStandaloneRouter.delete('/:id', authMiddleware, organizationMiddleware, validate(waveIdParamSchema), deleteWave);

export default waveStandaloneRouter;
