// src/routes/superAdminRoutes.ts
import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import superAdminMiddleware from '../middleware/superAdminMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  getPlatformWideStats,
  listAllOrganizations,
  updateOrganizationStatus,
  updateOrganizationDetails,
  listAllUsers,
  updateUserStatus,
  updateUserRoleAsSuperAdmin,
  cleanupStaleRequests,
  purgeExpiredTokens,
} from '../controllers/superAdminController.js';
import {
  listSuperAdminOrgsSchema,
  updateOrgStatusSchema,
  updateOrgDetailsSchema,
  listSuperAdminUsersSchema,
  updateUserStatusSchema,
  updateUserRoleAsSuperAdminSchema,
  cleanupStaleRequestsSchema,
  purgeExpiredTokensSchema,
} from '../schemas/superAdminSchemas.js';

const router = Router();

// All super-admin routes require a valid JWT (authMiddleware) and SUPER_ADMIN role.
// Note: organizationMiddleware is intentionally NOT applied here — these routes are
// platform-wide and must not be scoped to a single organization.
router.use(authMiddleware, superAdminMiddleware);

/**
 * @openapi
 * /api/super-admin/stats:
 *   get:
 *     tags: [Super Admin]
 *     summary: Platform-wide aggregate statistics
 *     description: Returns total counts for organizations, users, pings, waves, and surges across the entire platform.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform statistics
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — SUPER_ADMIN only
 */
router.get('/stats', getPlatformWideStats);

/**
 * @openapi
 * /api/super-admin/organizations:
 *   get:
 *     tags: [Super Admin]
 *     summary: List all organizations
 *     description: Returns all organizations on the platform with user/ping counts. Filterable by status.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, ACTIVE]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of organizations
 */
router.get('/organizations', validate(listSuperAdminOrgsSchema), listAllOrganizations);

/**
 * @openapi
 * /api/super-admin/organizations/{id}/status:
 *   patch:
 *     tags: [Super Admin]
 *     summary: Activate or deactivate an organization
 *     description: Setting status to PENDING locks all org members out until re-activated.
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, PENDING]
 *     responses:
 *       200:
 *         description: Updated organization
 *       404:
 *         description: Organization not found
 */
router.patch('/organizations/:id/status', validate(updateOrgStatusSchema), updateOrganizationStatus);

/**
 * @openapi
 * /api/super-admin/organizations/{id}:
 *   patch:
 *     tags: [Super Admin]
 *     summary: Edit organization details
 *     description: Update an organization's name, domain, or join policy. Enforces uniqueness for name and domain.
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
 *             properties:
 *               name:
 *                 type: string
 *               domain:
 *                 type: string
 *                 nullable: true
 *               joinPolicy:
 *                 type: string
 *                 enum: [OPEN, REQUIRES_APPROVAL]
 *     responses:
 *       200:
 *         description: Updated organization
 *       404:
 *         description: Organization not found
 *       409:
 *         description: Name or domain already in use
 */
router.patch('/organizations/:id', validate(updateOrgDetailsSchema), updateOrganizationDetails);

/**
 * @openapi
 * /api/super-admin/users:
 *   get:
 *     tags: [Super Admin]
 *     summary: List all users across all organizations
 *     description: Filterable by orgId, role, status, or email search.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: orgId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [USER, REPRESENTATIVE, ADMIN, SUPER_ADMIN]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, PENDING]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/users', validate(listSuperAdminUsersSchema), listAllUsers);

/**
 * @openapi
 * /api/super-admin/users/{id}/status:
 *   patch:
 *     tags: [Super Admin]
 *     summary: Activate or deactivate (ban) a user
 *     description: Setting status to PENDING prevents the user from authenticating. Cannot deactivate SUPER_ADMIN accounts.
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, PENDING]
 *     responses:
 *       200:
 *         description: Updated user
 *       400:
 *         description: Cannot deactivate a SUPER_ADMIN account
 *       404:
 *         description: User not found
 */
router.patch('/users/:id/status', validate(updateUserStatusSchema), updateUserStatus);

/**
 * @openapi
 * /api/super-admin/users/{id}/role:
 *   patch:
 *     tags: [Super Admin]
 *     summary: Set a user's role (unrestricted)
 *     description: |
 *       Assigns any role including SUPER_ADMIN. The org-scoped ADMIN version blocks SUPER_ADMIN assignment.
 *       A super admin cannot change their own role.
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
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [USER, REPRESENTATIVE, ADMIN, SUPER_ADMIN]
 *     responses:
 *       200:
 *         description: Updated user
 *       400:
 *         description: Cannot change your own role
 *       404:
 *         description: User not found
 */
router.patch('/users/:id/role', validate(updateUserRoleAsSuperAdminSchema), updateUserRoleAsSuperAdmin);

/**
 * @openapi
 * /api/super-admin/maintenance/cleanup-stale-requests:
 *   post:
 *     tags: [Super Admin]
 *     summary: Auto-reject stale pending organization requests
 *     description: Rejects all PENDING OrganizationRequests older than the specified number of days. Supports a dry-run mode that returns the list of affected requests without committing changes.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dryRun:
 *                 type: boolean
 *                 default: false
 *               olderThanDays:
 *                 type: integer
 *                 default: 30
 *                 minimum: 1
 *                 maximum: 365
 *     responses:
 *       200:
 *         description: Cleanup result with number of affected requests
 */
router.post('/maintenance/cleanup-stale-requests', validate(cleanupStaleRequestsSchema), cleanupStaleRequests);

/**
 * @openapi
 * /api/super-admin/maintenance/purge-expired-tokens:
 *   post:
 *     tags: [Super Admin]
 *     summary: Delete expired and used auth tokens
 *     description: |
 *       Purges expired or used EmailVerificationTokens and PasswordResetTokens.
 *       These accumulate indefinitely and are never cleaned up automatically.
 *       Supports dry-run mode.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dryRun:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Purge result with counts per token type
 */
router.post('/maintenance/purge-expired-tokens', validate(purgeExpiredTokensSchema), purgeExpiredTokens);

export default router;
