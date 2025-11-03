import { Router } from 'express';
import { getCategories } from '../controllers/categoryController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';

const router = Router();

// GET /api/categories?q=
router.get('/', authMiddleware, organizationMiddleware, getCategories);

export default router;
