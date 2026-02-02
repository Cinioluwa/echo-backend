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
import { cache } from '../middleware/cacheMiddleware.js';

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

// Get all pings (with pagination and optional filters) - cached for 60s
router.get('/', authMiddleware, organizationMiddleware, validate(paginationWithFiltersSchema), cache(60), getAllPings);

/**
 * @openapi
 * /api/pings/search:
 *   get:
 *     summary: Search pings by hashtag or text
 *     description: |
 *       Search for pings using hashtags or text queries.
 *       
 *       **Authentication required**: User must be logged in.
 *       **Organization scoped**: Only searches pings in user's organization.
 *       
 *       **Search modes:**
 *       - Hashtag search: Use `#hashtag` format
 *       - Text search: Searches in title and content
 *     tags:
 *       - Pings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (text or #hashtag)
 *         example: "#wifi"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Search results
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
 *       400:
 *         description: Missing search query
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
// Search pings by hashtag or text query (must come BEFORE /:id route) - cached for 30s
router.get('/search', authMiddleware, organizationMiddleware, validate(searchSchema), cache(30), searchPings);

/**
 * @openapi
 * /api/pings/me:
 *   get:
 *     summary: Get current user's pings
 *     description: |
 *       Retrieve all pings created by the authenticated user.
 *       Useful for "My Posts" or profile sections.
 *       
 *       **Authentication required**: User must be logged in.
 *     tags:
 *       - Pings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: User's pings
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
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
// Get current user's pings (must come BEFORE /:id route) - cached per user for 60s
router.get('/me', authMiddleware, validate(paginationSchema), cache(60, { perUser: true }), getMyPings);

/**
 * @openapi
 * /api/pings/{id}:
 *   get:
 *     summary: Get a specific ping by ID
 *     description: |
 *       Retrieve detailed information about a specific ping.
 *       
 *       **Authentication required**: User must be logged in.
 *       **Organization scoped**: Can only view pings from user's organization.
 *     tags:
 *       - Pings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ping ID
 *     responses:
 *       200:
 *         description: Ping details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Ping'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ping not found
 *       500:
 *         description: Internal server error
 *   delete:
 *     summary: Delete a ping
 *     description: |
 *       Delete a ping. Only the original author or an admin can delete.
 *       
 *       **Authorization**: Ping author or Admin only.
 *       
 *       **Warning**: This also deletes all associated waves, comments, and surges.
 *     tags:
 *       - Pings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Ping deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to delete this ping
 *       404:
 *         description: Ping not found
 *       500:
 *         description: Internal server error
 *   patch:
 *     summary: Update a ping
 *     description: |
 *       Update the content of a ping. Only the original author can update.
 *       
 *       **Authorization**: Ping author only.
 *     tags:
 *       - Pings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               hashtag:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ping updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Ping'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to update this ping
 *       404:
 *         description: Ping not found
 *       500:
 *         description: Internal server error
 */
// Get a specific ping by ID - with ID validation - cached for 60s
router.get('/:id', authMiddleware, organizationMiddleware, validate(pingIdSchema), cache(60), getPingById);

// Delete a ping - with ID validation
router.delete('/:id', authMiddleware, organizationMiddleware, validate(pingIdSchema), deletePing);

// Update a ping - with ID and body validation
router.patch('/:id', authMiddleware, organizationMiddleware, validate(pingIdSchema), validate(updatePingSchema), updatePing);

/**
 * @openapi
 * /api/pings/{id}/status:
 *   patch:
 *     summary: Update ping moderation status
 *     description: |
 *       Update the moderation status of a ping (approve/decline).
 *       
 *       **Admin only**: Requires ADMIN role.
 *     tags:
 *       - Pings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROVED, DECLINED]
 *     responses:
 *       200:
 *         description: Status updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Ping not found
 *       500:
 *         description: Internal server error
 */
// Update ping status (admin only) - with ID validation
router.patch('/:id/status', authMiddleware, adminMiddleware, organizationMiddleware, validate(pingIdSchema), updatePingStatus);

/**
 * @openapi
 * /api/pings/{id}/submit:
 *   patch:
 *     summary: Submit ping for representative review
 *     description: |
 *       Submit a ping to be reviewed by organization representatives.
 *       This escalates the issue for official attention.
 *       
 *       **Representative only**: Requires REPRESENTATIVE or ADMIN role.
 *     tags:
 *       - Pings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Ping submitted for review
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Ping submitted for review
 *                 ping:
 *                   $ref: '#/components/schemas/Ping'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Representative access required
 *       404:
 *         description: Ping not found
 *       500:
 *         description: Internal server error
 */
router.patch('/:id/submit', authMiddleware, representativeMiddleware, organizationMiddleware, validate(pingIdSchema), submitPing);

export default router;