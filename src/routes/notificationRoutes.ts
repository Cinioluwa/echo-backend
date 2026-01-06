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

const router = Router();

router.get('/', authMiddleware, organizationMiddleware, validate(listNotificationsSchema), listNotifications);
router.get('/unread-count', authMiddleware, organizationMiddleware, getUnreadNotificationCount);
router.patch('/:id/read', authMiddleware, organizationMiddleware, validate(notificationIdParamSchema), markNotificationRead);

export default router;
