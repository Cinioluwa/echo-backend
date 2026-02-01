import { Router } from 'express';
import {
    createPing,
    getAllPings,
    searchPings,
    getMyPings,
    getPingById,
    deletePing,
    updatePing,
    updatePingStatus,
    submitPing
} from '../controllers/pingController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';
import adminMiddleware from '../middleware/adminMiddleware.js';
import representativeMiddleware from '../middleware/representativeMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { createPingSchema, updatePingSchema, pingIdSchema } from '../schemas/pingSchemas.js';
import { paginationSchema, paginationWithFiltersSchema, searchSchema } from '../schemas/paginationSchema.js';

const router = Router();

/**
 * @openapi
 * /api/pings:
 *   post:
 *     summary: Create a new ping (issue)
 *     description: |
 *       Create a new ping in the user's organization. Pings represent issues,
 *       problems, or feedback items that need attention.
 *       
 *       **Authentication required**: User must be logged in.
 *       **Organization scoped**: Ping is created in user's organization.
 *     tags:
 *       - Pings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *               - categoryId
 *             properties:
 *               title:
 *                 type: string
 *                 description: Ping title
 *                 example: Internet connectivity issues in library
 *               content:
 *                 type: string
 *                 description: Detailed description of the issue
 *                 example: The WiFi in the library has been unstable for the past week, making it difficult to study.
 *               categoryId:
 *                 type: integer
 *                 description: Category ID (must belong to user's organization)
 *                 example: 1
 *               hashtag:
 *                 type: string
 *                 nullable: true
 *                 description: Optional hashtag for categorization
 *                 example: "#wifi"
 *               isAnonymous:
 *                 type: boolean
 *                 description: Whether to post anonymously
 *                 default: false
 *                 example: false
 *     responses:
 *       201:
 *         description: Ping created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Ping'
 *       400:
 *         description: Bad request - Missing required fields or invalid category
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingFields:
 *                 value:
 *                   error: Title, content and categoryId are required
 *               invalidCategory:
 *                 value:
 *                   error: Invalid categoryId for this organization
 *                   code: CATEGORY_NOT_FOUND
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *   get:
 *     summary: List all pings with filters
 *     description: |
 *       Get a paginated list of pings in the user's organization with optional filters.
 *       
 *       **Authentication required**: User must be logged in.
 *       **Organization scoped**: Only returns pings from user's organization.
 *     tags:
 *       - Pings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: category
 *         schema:
 *           type: integer
 *         description: Filter by category ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, DECLINED]
 *         description: Filter by ping status
 *     responses:
 *       200:
 *         description: List of pings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Ping'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */

// Create a new ping - with validation
router.post('/', authMiddleware, organizationMiddleware, validate(createPingSchema), createPing);

// Get all pings (with pagination and optional filters)
router.get('/', authMiddleware, organizationMiddleware, validate(paginationWithFiltersSchema), getAllPings);

// Search pings by hashtag or text query (must come BEFORE /:id route)
router.get('/search', authMiddleware, organizationMiddleware, validate(searchSchema), searchPings);

// Get current user's pings (must come BEFORE /:id route)
router.get('/me', authMiddleware, validate(paginationSchema), getMyPings);

// Get a specific ping by ID - with ID validation
router.get('/:id', authMiddleware, organizationMiddleware, validate(pingIdSchema), getPingById);

// Delete a ping - with ID validation
router.delete('/:id', authMiddleware, organizationMiddleware, validate(pingIdSchema), deletePing);

// Update a ping - with ID and body validation
router.patch('/:id', authMiddleware, organizationMiddleware, validate(pingIdSchema), validate(updatePingSchema), updatePing);

// Update ping status (admin only) - with ID validation
router.patch('/:id/status', authMiddleware, adminMiddleware, organizationMiddleware, validate(pingIdSchema), updatePingStatus);

router.patch('/:id/submit', authMiddleware, representativeMiddleware, organizationMiddleware, validate(pingIdSchema), submitPing);

export default router;