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

const router = Router();

router.get('/stats', authMiddleware, adminMiddleware, getPlatformStats);
router.get('/pings', authMiddleware, adminMiddleware, getAllPingsAsAdmin);
router.delete('/pings/:id', authMiddleware, adminMiddleware, deleteAnyPing);
router.get('/users', authMiddleware, adminMiddleware, getAllUsers);
router.patch('/users/:id/role', authMiddleware, adminMiddleware, updateUserRole);
router.post('/announcements', authMiddleware, adminMiddleware, createAnnouncement);
router.patch('/announcements/:id', authMiddleware, adminMiddleware, updateAnnouncement);
router.delete('/announcements/:id', authMiddleware, adminMiddleware, deleteAnnouncement);
router.get('/analytics/by-level', authMiddleware, adminMiddleware, getPingsByLevel);
router.get('/analytics/by-category', authMiddleware, adminMiddleware, getPingStatsByCategory);
router.get('/users/:id', authMiddleware, adminMiddleware, getUserByIdAsAdmin);

export default router;

