import { Router } from 'express';
import { getAllPingsAsAdmin } from '../controllers/pingController.js';
import cache from '../middleware/cacheMiddleware.js';
import {
    getPlatformStats,
    deleteAnyPing,
    getAllUsers,
    updateUserRole,
    getPingStatsByCategory,
    getPingsByLevel,
    getUserByIdAsAdmin,
    updatePingProgressStatus,
    acknowledgePing,
    resolvePing,
    getResponseTimeAnalytics,
    getAllWavesAsAdmin,
    updateWaveStatusAsAdmin,
    getActiveUsersAnalytics,
    getTrendingCategories,
    getPingSentimentAnalytics,
    getPriorityPings,
    exportPingsAsCsv,

} from '../controllers/adminController.js';
import {
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement
} from '../controllers/announcementController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import adminMiddleware from '../middleware/adminMiddleware.js';
import superAdminMiddleware from '../middleware/superAdminMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { paginationWithFiltersSchema, paginationWithStatusSchema } from '../schemas/paginationSchema.js';
import { paginationSchema } from '../schemas/paginationSchema.js';
import { pingIdSchema } from '../schemas/pingSchemas.js';
import { userIdParamSchema } from '../schemas/userSchemas.js';
import {
    analyticsWindowOptionalSchema,
    analyticsWindowSchema,
    priorityPingsSchema,
    responseTimeAnalyticsSchema,
    updateUserRoleSchema,
} from '../schemas/adminSchemas.js';
import { waveIdParamSchema, updateWaveStatusSchema } from '../schemas/waveSchemas.js';
import {
    createAnnouncementSchema,
    updateAnnouncementSchema
} from '../schemas/announcementSchemas.js';
import {
    approveOrganizationRequest,
    listOrganizationRequests,
    rejectOrganizationRequest,
} from '../controllers/organizationRequestController.js';

const router = Router();

/**
 * @openapi
 * /api/admin/stats:
 *   get:
 *     summary: Get platform statistics
 *     description: |
 *       Retrieve overall statistics for the organization including:
 *       - Total pings, waves, comments, users
 *       - Active users count
 *       - Resolution rates
 *       
 *       **Admin only**: Requires ADMIN or REPRESENTATIVE role.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalPings:
 *                   type: integer
 *                 totalWaves:
 *                   type: integer
 *                 totalComments:
 *                   type: integer
 *                 totalUsers:
 *                   type: integer
 *                 resolvedPings:
 *                   type: integer
 *                 pendingPings:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/stats', authMiddleware, adminMiddleware, organizationMiddleware, cache(60), getPlatformStats);

/**
 * @openapi
 * /api/admin/organization-requests:
 *   get:
 *     summary: List organization onboarding requests
 *     description: |
 *       List all pending organization onboarding requests.
 *       
 *       **Super Admin only**: Platform-wide endpoint.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of organization requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   email:
 *                     type: string
 *                   organizationName:
 *                     type: string
 *                   status:
 *                     type: string
 *                     enum: [PENDING, APPROVED, REJECTED]
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Super Admin access required
 */
// Platform-wide onboarding requests (SUPER_ADMIN only)
router.get('/organization-requests', authMiddleware, superAdminMiddleware, listOrganizationRequests);

/**
 * @openapi
 * /api/admin/organization-requests/{id}/approve:
 *   post:
 *     summary: Approve an organization request
 *     description: |
 *       Approve a pending organization onboarding request.
 *       Creates the organization and enables user registration.
 *       
 *       **Super Admin only**
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization request ID
 *     responses:
 *       200:
 *         description: Request approved successfully
 *       404:
 *         description: Request not found
 *       403:
 *         description: Super Admin access required
 */
router.post('/organization-requests/:id/approve', authMiddleware, superAdminMiddleware, approveOrganizationRequest);

/**
 * @openapi
 * /api/admin/organization-requests/{id}/reject:
 *   post:
 *     summary: Reject an organization request
 *     description: |
 *       Reject a pending organization onboarding request.
 *       
 *       **Super Admin only**
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization request ID
 *     responses:
 *       200:
 *         description: Request rejected successfully
 *       404:
 *         description: Request not found
 *       403:
 *         description: Super Admin access required
 */
router.post('/organization-requests/:id/reject', authMiddleware, superAdminMiddleware, rejectOrganizationRequest);

/**
 * @openapi
 * /api/admin/pings:
 *   get:
 *     summary: Get all pings (admin view)
 *     description: |
 *       Retrieve all pings in the organization with admin-level access.
 *       Includes all statuses and additional metadata.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, DECLINED, POSTED]
 *       - in: query
 *         name: category
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated list of pings
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.get('/pings', authMiddleware, adminMiddleware, validate(paginationWithFiltersSchema), getAllPingsAsAdmin);

/**
 * @openapi
 * /api/admin/pings/{id}:
 *   delete:
 *     summary: Delete any ping
 *     description: |
 *       Delete any ping regardless of author.
 *       
 *       **Admin only**: Admins can delete any ping for moderation purposes.
 *     tags:
 *       - Admin
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
 *       404:
 *         description: Ping not found
 *       403:
 *         description: Admin access required
 */
router.delete('/pings/:id', authMiddleware, adminMiddleware, organizationMiddleware, validate(pingIdSchema), deleteAnyPing);

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     summary: Get all users in organization
 *     description: |
 *       Retrieve all users in the organization with their roles and statuses.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       403:
 *         description: Admin access required
 */
router.get('/users', authMiddleware, adminMiddleware, organizationMiddleware, getAllUsers);

/**
 * @openapi
 * /api/admin/users/{id}/role:
 *   patch:
 *     summary: Update a user's role
 *     description: |
 *       Change a user's role (USER, REPRESENTATIVE, ADMIN).
 *       
 *       **Admin only**: Cannot demote yourself or other admins.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [USER, REPRESENTATIVE, ADMIN]
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       400:
 *         description: Invalid role
 *       403:
 *         description: Cannot modify this user
 *       404:
 *         description: User not found
 */
router.patch('/users/:id/role', authMiddleware, adminMiddleware, organizationMiddleware, validate(updateUserRoleSchema), updateUserRole);

/**
 * @openapi
 * /api/admin/announcements:
 *   post:
 *     summary: Create an announcement
 *     description: |
 *       Create a new organization-wide announcement.
 *       Announcements are displayed to all users in the organization.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
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
 *             properties:
 *               title:
 *                 type: string
 *                 example: System Maintenance Scheduled
 *               content:
 *                 type: string
 *                 example: The system will be under maintenance on Saturday from 2-4 AM.
 *               categoryId:
 *                 type: integer
 *                 description: Optional category to target
 *               targetLevels:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Target specific user levels
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: When the announcement expires
 *     responses:
 *       201:
 *         description: Announcement created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Announcement'
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Admin access required
 */
router.post('/announcements', authMiddleware, adminMiddleware, organizationMiddleware, validate(createAnnouncementSchema), createAnnouncement);

/**
 * @openapi
 * /api/admin/announcements/{id}:
 *   patch:
 *     summary: Update an announcement
 *     description: |
 *       Update an existing announcement.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
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
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Announcement updated
 *       404:
 *         description: Announcement not found
 *       403:
 *         description: Admin access required
 *   delete:
 *     summary: Delete an announcement
 *     description: |
 *       Delete an announcement.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
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
 *         description: Announcement deleted
 *       404:
 *         description: Announcement not found
 *       403:
 *         description: Admin access required
 */
router.patch('/announcements/:id', authMiddleware, adminMiddleware, organizationMiddleware, validate(updateAnnouncementSchema), updateAnnouncement);
router.delete('/announcements/:id', authMiddleware, adminMiddleware, organizationMiddleware, deleteAnnouncement);

/**
 * @openapi
 * /api/admin/analytics/by-level:
 *   get:
 *     summary: Get ping statistics by user level
 *     description: |
 *       Analyze ping distribution across different user levels.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: window
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *         description: Time window for analysis
 *     responses:
 *       200:
 *         description: Statistics by user level
 *       403:
 *         description: Admin access required
 */
router.get('/analytics/by-level', authMiddleware, adminMiddleware, organizationMiddleware, validate(analyticsWindowOptionalSchema), cache(120), getPingsByLevel);

/**
 * @openapi
 * /api/admin/analytics/by-category:
 *   get:
 *     summary: Get ping statistics by category
 *     description: |
 *       Analyze ping distribution across categories.
 *       Shows which categories have the most activity.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: window
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *     responses:
 *       200:
 *         description: Statistics by category
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   categoryId:
 *                     type: integer
 *                   categoryName:
 *                     type: string
 *                   pingCount:
 *                     type: integer
 *       403:
 *         description: Admin access required
 */
router.get('/analytics/by-category', authMiddleware, adminMiddleware, organizationMiddleware, validate(analyticsWindowOptionalSchema), cache(120), getPingStatsByCategory);

/**
 * @openapi
 * /api/admin/analytics/active-users:
 *   get:
 *     summary: Get active users analytics
 *     description: |
 *       Analyze user activity patterns over time.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: window
 *         required: true
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *     responses:
 *       200:
 *         description: Active users statistics
 *       403:
 *         description: Admin access required
 */
router.get('/analytics/active-users', authMiddleware, adminMiddleware, organizationMiddleware, validate(analyticsWindowSchema), cache(120), getActiveUsersAnalytics);

/**
 * @openapi
 * /api/admin/analytics/trending:
 *   get:
 *     summary: Get trending categories
 *     description: |
 *       Identify categories with increasing activity.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: window
 *         required: true
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *     responses:
 *       200:
 *         description: Trending categories
 *       403:
 *         description: Admin access required
 */
router.get('/analytics/trending', authMiddleware, adminMiddleware, organizationMiddleware, validate(analyticsWindowSchema), cache(120), getTrendingCategories);

/**
 * @openapi
 * /api/admin/analytics/sentiment:
 *   get:
 *     summary: Get ping sentiment analytics
 *     description: |
 *       Analyze sentiment distribution across pings.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: window
 *         required: true
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *     responses:
 *       200:
 *         description: Sentiment analytics
 *       403:
 *         description: Admin access required
 */
router.get('/analytics/sentiment', authMiddleware, adminMiddleware, organizationMiddleware, validate(analyticsWindowSchema), cache(120), getPingSentimentAnalytics);

/**
 * @openapi
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get a specific user's details
 *     description: |
 *       Retrieve detailed information about a specific user.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
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
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       403:
 *         description: Admin access required
 */
router.get('/users/:id', authMiddleware, adminMiddleware, organizationMiddleware, validate(userIdParamSchema), getUserByIdAsAdmin);

/**
 * @openapi
 * /api/admin/pings/priority:
 *   get:
 *     summary: Get priority pings
 *     description: |
 *       Get pings that require attention based on surge count and age.
 *       Useful for identifying issues that need immediate response.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: minSurges
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Minimum surge count
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Priority pings list
 *       403:
 *         description: Admin access required
 */
router.get('/pings/priority', authMiddleware, adminMiddleware, organizationMiddleware, validate(priorityPingsSchema), getPriorityPings);

/**
 * @openapi
 * /api/admin/pings/{id}/progress-status:
 *   patch:
 *     summary: Update ping progress status
 *     description: |
 *       Update the progress status of a ping.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
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
 *               - progressStatus
 *             properties:
 *               progressStatus:
 *                 type: string
 *                 enum: [UNACKNOWLEDGED, ACKNOWLEDGED, IN_PROGRESS, RESOLVED]
 *     responses:
 *       200:
 *         description: Progress status updated
 *       404:
 *         description: Ping not found
 *       403:
 *         description: Admin access required
 */
router.patch('/pings/:id/progress-status', authMiddleware, adminMiddleware, organizationMiddleware, updatePingProgressStatus);

/**
 * @openapi
 * /api/admin/pings/{id}/acknowledge:
 *   post:
 *     summary: Acknowledge a ping
 *     description: |
 *       Mark a ping as acknowledged. Sets acknowledgedAt timestamp.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
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
 *         description: Ping acknowledged
 *       404:
 *         description: Ping not found
 *       403:
 *         description: Admin access required
 */
router.post('/pings/:id/acknowledge', authMiddleware, adminMiddleware, organizationMiddleware, validate(pingIdSchema), acknowledgePing);

/**
 * @openapi
 * /api/admin/pings/{id}/resolve:
 *   post:
 *     summary: Resolve a ping
 *     description: |
 *       Mark a ping as resolved. Sets resolvedAt timestamp.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
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
 *         description: Ping resolved
 *       404:
 *         description: Ping not found
 *       403:
 *         description: Admin access required
 */
router.post('/pings/:id/resolve', authMiddleware, adminMiddleware, organizationMiddleware, validate(pingIdSchema), resolvePing);

/**
 * @openapi
 * /api/admin/analytics/response-times:
 *   get:
 *     summary: Get response time analytics
 *     description: |
 *       Analyze how quickly pings are being acknowledged and resolved.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: window
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *     responses:
 *       200:
 *         description: Response time statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 averageAcknowledgeTime:
 *                   type: number
 *                   description: Average time to acknowledge in hours
 *                 averageResolveTime:
 *                   type: number
 *                   description: Average time to resolve in hours
 *       403:
 *         description: Admin access required
 */
router.get('/analytics/response-times', authMiddleware, adminMiddleware, organizationMiddleware, validate(responseTimeAnalyticsSchema), getResponseTimeAnalytics);

/**
 * @openapi
 * /api/admin/export/pings:
 *   get:
 *     summary: Export pings as CSV
 *     description: |
 *       Download all pings as a CSV file for reporting/analysis.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       403:
 *         description: Admin access required
 */
router.get('/export/pings', authMiddleware, adminMiddleware, organizationMiddleware, exportPingsAsCsv);

/**
 * @openapi
 * /api/admin/waves:
 *   get:
 *     summary: Get all waves (admin view)
 *     description: |
 *       Retrieve all waves in the organization for moderation.
 *       Includes all statuses and flagged waves.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, DECLINED, POSTED]
 *     responses:
 *       200:
 *         description: Paginated list of waves
 *       403:
 *         description: Admin access required
 */
// Waves moderation (ADMIN)
router.get('/waves', authMiddleware, adminMiddleware, organizationMiddleware, validate(paginationWithStatusSchema), getAllWavesAsAdmin);

/**
 * @openapi
 * /api/admin/waves/{id}/status:
 *   patch:
 *     summary: Update wave status
 *     description: |
 *       Approve or decline a wave for moderation.
 *       
 *       **Admin only**
 *     tags:
 *       - Admin
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
 *         description: Wave status updated
 *       404:
 *         description: Wave not found
 *       403:
 *         description: Admin access required
 */
router.patch('/waves/:id/status', authMiddleware, adminMiddleware, organizationMiddleware, validate(waveIdParamSchema), validate(updateWaveStatusSchema), updateWaveStatusAsAdmin);

export default router;

