import { Router } from 'express';
import { getAnnouncements } from '../controllers/announcementController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { getAnnouncementsSchema } from '../schemas/announcementSchemas.js';
import { cache } from '../middleware/cacheMiddleware.js';

const router = Router();

// GET announcements - cached for 2 minutes
router.get('/', authMiddleware, organizationMiddleware, validate(getAnnouncementsSchema), cache(120), getAnnouncements);

export default router;