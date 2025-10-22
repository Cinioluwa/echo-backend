import { Router } from 'express';
import { getAllPingsAsAdmin } from '../controllers/pingController.js';
import {
     getPlatformStats, 
     deleteAnyPing,
     getAllUsers,
     updateUserRole
    } from '../controllers/adminController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import adminMiddleware from '../middleware/adminMiddleware.js';

const router = Router();

router.get('/stats', authMiddleware, adminMiddleware, getPlatformStats);
router.get('/pings', authMiddleware, adminMiddleware, getAllPingsAsAdmin);
router.delete('/pings/:id', authMiddleware, adminMiddleware, deleteAnyPing);
router.get('/users', authMiddleware, adminMiddleware, getAllUsers);
router.patch('/users/:id/role', authMiddleware, adminMiddleware, updateUserRole);

export default router;

