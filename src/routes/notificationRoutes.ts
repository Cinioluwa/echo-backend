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

// Notifications are user-specific, cache per user for 30s
router.get('/', authMiddleware, organizationMiddleware, validate(listNotificationsSchema), cache(30, { perUser: true }), listNotifications);
router.get('/unread-count', authMiddleware, organizationMiddleware, cache(15, { perUser: true }), getUnreadNotificationCount);
router.patch('/:id/read', authMiddleware, organizationMiddleware, validate(notificationIdParamSchema), markNotificationRead);

export default router;
