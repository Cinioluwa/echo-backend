import { Router } from 'express';
import { getAllPingsAsAdmin } from '../controllers/pingController.js';
import { getPlatformStats, deleteAnyPing } from '../controllers/adminController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import adminMiddleware from '../middleware/adminMiddleware.js';

const router = Router();

router.get('/stats', authMiddleware, adminMiddleware, getPlatformStats);
router.get('/pings', authMiddleware, adminMiddleware, getAllPingsAsAdmin);

router.delete('/pings/:id', authMiddleware, adminMiddleware, deleteAnyPing);

export default router;

