import { Router } from 'express';
import { getCategories, createCategory } from '../controllers/categoryController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';

const router = Router();

/**
 * @openapi
 * /api/categories:
 *   get:
 *     summary: Get all categories for user's organization
 *     description: |
 *       Retrieve all categories available in the authenticated user's organization.
 *       Categories are used to classify pings (issues) and waves (solutions).
 *       
 *       **Authentication required**: User must be logged in.
 *       **Organization scoped**: Only returns categories for user's organization.
 *       
 *       **Frontend integration tip**: Fetch categories once on app load and cache them.
 *       Use category IDs for filtering in soundboard/stream views.
 *     tags:
 *       - Categories
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Optional search query (case-insensitive partial match on category name)
 *         example: academic
 *     responses:
 *       200:
 *         description: List of categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 *             example:
 *               - id: 1
 *                 name: Academic
 *               - id: 2
 *                 name: Facilities
 *               - id: 3
 *                 name: Social
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Organization not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
// GET /api/categories?q=
router.get('/', authMiddleware, organizationMiddleware, getCategories);
router.post('/', authMiddleware, organizationMiddleware, createCategory);

export default router;
