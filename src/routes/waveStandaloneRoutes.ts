import { Router } from 'express';
import { getWaveById } from '../controllers/waveController.js';
import { validate } from '../middleware/validationMiddleware.js';
import { waveIdParamSchema } from '../schemas/waveSchemas.js';

const waveStandaloneRouter = Router();

// GET /api/waves/:id - Standalone public route
waveStandaloneRouter.get('/:id', validate(waveIdParamSchema), getWaveById);

export default waveStandaloneRouter;
