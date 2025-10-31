import { Router } from 'express';
import { getAnnouncements } from '../controllers/announcementController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { getAnnouncementsSchema } from '../schemas/announcementSchemas.js';

const router = Router();

router.get('/', authMiddleware, organizationMiddleware, validate(getAnnouncementsSchema), getAnnouncements);

export default router;