import { Router } from 'express';
import { getAllPingsAsAdmin } from '../controllers/pingController.js';
import { getPlatformStats } from '../controllers/adminController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import adminMiddleware from '../middleware/adminMiddleware.js';

const router = Router();

router.get('/stats', authMiddleware, adminMiddleware, getPlatformStats);

router.get('/pings', authMiddleware, adminMiddleware, getAllPingsAsAdmin);

export default router;

