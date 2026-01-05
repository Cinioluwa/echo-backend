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
    acknowledgePing,
    resolvePing,
    getResponseTimeAnalytics,
    getAllWavesAsAdmin,
    updateWaveStatusAsAdmin,
    getActiveUsersAnalytics,

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
import { analyticsWindowOptionalSchema, analyticsWindowSchema, responseTimeAnalyticsSchema, updateUserRoleSchema } from '../schemas/adminSchemas.js';
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

router.get('/stats', authMiddleware, adminMiddleware, organizationMiddleware, getPlatformStats);

// Platform-wide onboarding requests (SUPER_ADMIN only)
router.get('/organization-requests', authMiddleware, superAdminMiddleware, listOrganizationRequests);
router.post('/organization-requests/:id/approve', authMiddleware, superAdminMiddleware, approveOrganizationRequest);
router.post('/organization-requests/:id/reject', authMiddleware, superAdminMiddleware, rejectOrganizationRequest);

router.get('/pings', authMiddleware, adminMiddleware, validate(paginationWithFiltersSchema), getAllPingsAsAdmin);
router.delete('/pings/:id', authMiddleware, adminMiddleware, organizationMiddleware, validate(pingIdSchema), deleteAnyPing);
router.get('/users', authMiddleware, adminMiddleware, organizationMiddleware, getAllUsers);
router.patch('/users/:id/role', authMiddleware, adminMiddleware, organizationMiddleware, validate(updateUserRoleSchema), updateUserRole);
router.post('/announcements', authMiddleware, adminMiddleware, organizationMiddleware, validate(createAnnouncementSchema), createAnnouncement);
router.patch('/announcements/:id', authMiddleware, adminMiddleware, organizationMiddleware, validate(updateAnnouncementSchema), updateAnnouncement);
router.delete('/announcements/:id', authMiddleware, adminMiddleware, organizationMiddleware, deleteAnnouncement);
router.get('/analytics/by-level', authMiddleware, adminMiddleware, organizationMiddleware, validate(analyticsWindowOptionalSchema), getPingsByLevel);
router.get('/analytics/by-category', authMiddleware, adminMiddleware, organizationMiddleware, validate(analyticsWindowOptionalSchema), getPingStatsByCategory);
router.get('/analytics/active-users', authMiddleware, adminMiddleware, organizationMiddleware, validate(analyticsWindowSchema), getActiveUsersAnalytics);
router.get('/users/:id', authMiddleware, adminMiddleware, organizationMiddleware, validate(userIdParamSchema), getUserByIdAsAdmin);
router.patch('/pings/:id/progress-status', authMiddleware, adminMiddleware, organizationMiddleware, updatePingProgressStatus);
router.post('/pings/:id/acknowledge', authMiddleware, adminMiddleware, organizationMiddleware, validate(pingIdSchema), acknowledgePing);
router.post('/pings/:id/resolve', authMiddleware, adminMiddleware, organizationMiddleware, validate(pingIdSchema), resolvePing);
router.get('/analytics/response-times', authMiddleware, adminMiddleware, organizationMiddleware, validate(responseTimeAnalyticsSchema), getResponseTimeAnalytics);

// Waves moderation (ADMIN)
router.get('/waves', authMiddleware, adminMiddleware, organizationMiddleware, validate(paginationWithStatusSchema), getAllWavesAsAdmin);
router.patch('/waves/:id/status', authMiddleware, adminMiddleware, organizationMiddleware, validate(waveIdParamSchema), validate(updateWaveStatusSchema), updateWaveStatusAsAdmin);

export default router;

