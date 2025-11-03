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
    updatePingProgressStatus,

    } from '../controllers/adminController.js';
import { 
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement
 } from '../controllers/announcementController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import adminMiddleware from '../middleware/adminMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';
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

router.get('/stats', authMiddleware, adminMiddleware, organizationMiddleware, getPlatformStats);
router.get('/pings', authMiddleware, adminMiddleware, validate(paginationWithFiltersSchema), getAllPingsAsAdmin);
router.delete('/pings/:id', authMiddleware, adminMiddleware, organizationMiddleware, validate(pingIdSchema), deleteAnyPing);
router.get('/users', authMiddleware, adminMiddleware, organizationMiddleware, getAllUsers);
router.patch('/users/:id/role', authMiddleware, adminMiddleware, organizationMiddleware, validate(updateUserRoleSchema), updateUserRole);
router.post('/announcements', authMiddleware, adminMiddleware, organizationMiddleware, validate(createAnnouncementSchema), createAnnouncement);
router.patch('/announcements/:id', authMiddleware, adminMiddleware, organizationMiddleware, validate(updateAnnouncementSchema), updateAnnouncement);
router.delete('/announcements/:id', authMiddleware, adminMiddleware, organizationMiddleware, deleteAnnouncement);
router.get('/analytics/by-level', authMiddleware, adminMiddleware, organizationMiddleware, getPingsByLevel);
router.get('/analytics/by-category', authMiddleware, adminMiddleware, organizationMiddleware, getPingStatsByCategory);
router.get('/users/:id', authMiddleware, adminMiddleware, organizationMiddleware, validate(userIdParamSchema), getUserByIdAsAdmin);
router.patch('/pings/:id/progress-status', authMiddleware, adminMiddleware, organizationMiddleware, updatePingProgressStatus);

export default router;

