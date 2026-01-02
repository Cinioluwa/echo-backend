import { Router } from 'express';
import { getCategories, createCategory } from '../controllers/categoryController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';

const router = Router();

// GET /api/categories?q=
router.get('/', authMiddleware, organizationMiddleware, getCategories);
router.post('/', authMiddleware, organizationMiddleware, createCategory);

export default router;
