import { Router } from 'express';
import { createOfficialResponse } from '../controllers/officialResponseController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import representativeMiddleware from '../middleware/representativeMiddleware.js';

const router = Router({mergeParams: true});

router.post(
    '/',
    authMiddleware,
    representativeMiddleware,
    createOfficialResponse
);

export default router;