// src/routes/surgeRoutes.ts
import { Router } from 'express';
import { toggleSurgeOnPing, toggleSurgeOnWave } from '../controllers/surgeController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { pingParamSchema, waveParamSchema } from '../schemas/waveSchemas.js';

// Router for ping surges: /api/pings/:pingId/surge
export const pingSurgeRouter = Router({ mergeParams: true });
pingSurgeRouter.post('/', authMiddleware, validate(pingParamSchema), toggleSurgeOnPing);  // Toggle surge on a ping (like/unlike)

// Router for wave surges: /api/waves/:waveId/surge
export const waveSurgeRouter = Router({ mergeParams: true });
waveSurgeRouter.post('/', authMiddleware, validate(waveParamSchema), toggleSurgeOnWave);  // Toggle surge on a wave (like/unlike)

// Default export for backward compatibility (wave surges)
export default waveSurgeRouter;