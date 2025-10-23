import { Router } from 'express';
import { getPublicPings, getPublicWaves } from '../controllers/publicController.js';

const router = Router();

// Public Soundboard (Pings)
router.get('/soundboard', getPublicPings);

// Public Stream (Waves)
router.get('/stream', getPublicWaves);

export default router;
