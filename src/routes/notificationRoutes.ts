import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  listNotificationsSchema,
  notificationIdParamSchema,
} from '../schemas/notificationSchemas.js';
import {
  getUnreadNotificationCount,
  listNotifications,
  markNotificationRead,
} from '../controllers/notificationController.js';
import { cache } from '../middleware/cacheMiddleware.js';

const router = Router();

/**
 * @openapi
 * /api/notifications:
 *   get:
 *     summary: List user notifications
 *     description: |
 *       Retrieve the authenticated user's notifications with pagination.
 *       
 *       **Authentication required**: User must be logged in.
 *       
 *       Notifications include:
 *       - New comments on your pings/waves
 *       - Surges on your content
 *       - Official responses to your pings
 *       - System announcements
 *     tags:
 *       - Notifications
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
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Only return unread notifications
 *     responses:
 *       200:
 *         description: List of notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
// Notifications are user-specific, cache per user for 30s
router.get('/', authMiddleware, organizationMiddleware, validate(listNotificationsSchema), cache(30, { perUser: true }), listNotifications);

/**
 * @openapi
 * /api/notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     description: |
 *       Get the count of unread notifications for the authenticated user.
 *       Useful for displaying badge counts in the UI.
 *       
 *       **Authentication required**: User must be logged in.
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 5
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/unread-count', authMiddleware, organizationMiddleware, cache(15, { perUser: true }), getUnreadNotificationCount);

/**
 * @openapi
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Mark a notification as read
 *     description: |
 *       Mark a specific notification as read.
 *       
 *       **Authentication required**: User must be logged in.
 *       **Authorization**: Can only mark your own notifications as read.
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Notification marked as read
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not your notification
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Internal server error
 */
router.patch('/:id/read', authMiddleware, organizationMiddleware, validate(notificationIdParamSchema), markNotificationRead);

export default router;
