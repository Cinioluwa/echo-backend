// src/routes/analyticsRoutes.ts
import { Router } from 'express';
import { getAdminOverview, getCategoryAnalytics, getPingLevelAnalytics } from '../controllers/analyticsController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';

const router = Router();

router.get('/admin/overview', authMiddleware, organizationMiddleware, getAdminOverview);
router.get('/admin/categories', authMiddleware, organizationMiddleware, getCategoryAnalytics);
router.get('/pings/:id/levels', authMiddleware, organizationMiddleware, getPingLevelAnalytics);

export default router;
