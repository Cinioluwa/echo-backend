import { Router } from 'express';
import { 
    createWave,
    getWavesForPing,
    getWaveById
} from '../controllers/waveController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { createWaveSchema, pingParamSchema } from '../schemas/waveSchemas.js';

// { mergeParams: true } is crucial for accessing :pingId from parent router
const router = Router({ mergeParams: true });

// POST /api/pings/:pingId/waves - Create a wave for a ping
router.post('/', authMiddleware, validate(createWaveSchema), createWave);

// GET /api/pings/:pingId/waves - Get all waves for a ping
router.get('/', validate(pingParamSchema), getWavesForPing);

// Standalone wave-by-id route will be mounted separately at /api/waves/:id

export default router;