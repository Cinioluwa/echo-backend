import { Router } from 'express';
import { getAnnouncements } from '../controllers/announcementController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { getAnnouncementsSchema } from '../schemas/announcementSchemas.js';
import { cache } from '../middleware/cacheMiddleware.js';

const router = Router();

/**
 * @openapi
 * /api/announcements:
 *   get:
 *     summary: Get active announcements
 *     description: |
 *       Retrieve all active announcements for the user's organization.
 *       
 *       **Authentication required**: User must be logged in.
 *       **Organization scoped**: Only returns announcements for user's organization.
 *       
 *       Announcements are filtered by:
 *       - Active status (not expired)
 *       - User's level (if targeted)
 *       - Organization membership
 *     tags:
 *       - Announcements
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
 *           default: 10
 *     responses:
 *       200:
 *         description: List of active announcements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Announcement'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
// GET announcements - cached for 2 minutes
router.get('/', authMiddleware, organizationMiddleware, validate(getAnnouncementsSchema), cache(120), getAnnouncements);

export default router;