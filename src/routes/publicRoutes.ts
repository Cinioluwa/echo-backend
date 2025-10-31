import { Router } from 'express';
import { getPublicPings, getPublicWaves } from '../controllers/publicController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';

const router = Router();

// Soundboard (Pings) - now requires auth
router.get('/soundboard', authMiddleware, organizationMiddleware, getPublicPings);

// Stream (Waves) - now requires auth
router.get('/stream', authMiddleware, organizationMiddleware, getPublicWaves);

export default router;
