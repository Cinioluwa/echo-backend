import { Router } from 'express';
import { getAllPingsAsAdmin } from '../controllers/pingController.js';
import {
     getPlatformStats, 
     deleteAnyPing,
     getAllUsers,
     updateUserRole,
     getPingStatsByCategory,
     getPingsByLevel,
     getUserByIdAsAdmin,

    } from '../controllers/adminController.js';
import { 
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement
 } from '../controllers/announcementController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import adminMiddleware from '../middleware/adminMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { paginationWithFiltersSchema } from '../schemas/paginationSchema.js';
import { pingIdSchema } from '../schemas/pingSchemas.js';
import { userIdParamSchema } from '../schemas/userSchemas.js';
import { updateUserRoleSchema } from '../schemas/adminSchemas.js';
import { 
    createAnnouncementSchema, 
    updateAnnouncementSchema 
} from '../schemas/announcementSchemas.js';

const router = Router();

router.get('/stats', authMiddleware, adminMiddleware, getPlatformStats);
router.get('/pings', authMiddleware, adminMiddleware, validate(paginationWithFiltersSchema), getAllPingsAsAdmin);
router.delete('/pings/:id', authMiddleware, adminMiddleware, validate(pingIdSchema), deleteAnyPing);
router.get('/users', authMiddleware, adminMiddleware, getAllUsers);
router.patch('/users/:id/role', authMiddleware, adminMiddleware, validate(updateUserRoleSchema), updateUserRole);
router.post('/announcements', authMiddleware, adminMiddleware, validate(createAnnouncementSchema), createAnnouncement);
router.patch('/announcements/:id', authMiddleware, adminMiddleware, validate(updateAnnouncementSchema), updateAnnouncement);
router.delete('/announcements/:id', authMiddleware, adminMiddleware, deleteAnnouncement);
router.get('/analytics/by-level', authMiddleware, adminMiddleware, getPingsByLevel);
router.get('/analytics/by-category', authMiddleware, adminMiddleware, getPingStatsByCategory);
router.get('/users/:id', authMiddleware, adminMiddleware, validate(userIdParamSchema), getUserByIdAsAdmin);

export default router;

