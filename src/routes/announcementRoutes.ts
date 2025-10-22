import { Router } from 'express';
import { getAnnouncements } from '../controllers/announcementController.js';
import { validate } from '../middleware/validationMiddleware.js';
import { getAnnouncementsSchema } from '../schemas/announcementSchemas.js';

const router = Router();

router.get('/', validate(getAnnouncementsSchema), getAnnouncements);

export default router;