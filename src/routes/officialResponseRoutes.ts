import { Router } from 'express';
import { createOfficialResponse } from '../controllers/officialResponseController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import representativeMiddleware from '../middleware/representativeMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { createOfficialResponseSchema } from '../schemas/officialResponseSchemas.js';

const router = Router({mergeParams: true});

router.post(
    '/',
    authMiddleware,
    representativeMiddleware,
    validate(createOfficialResponseSchema),
    createOfficialResponse
);

export default router;