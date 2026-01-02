import { Router } from 'express';
import { createOfficialResponse, updateOfficialResponse } from '../controllers/officialResponseController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import representativeMiddleware from '../middleware/representativeMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { createOfficialResponseSchema, updateOfficialResponseSchema } from '../schemas/officialResponseSchemas.js';

const router = Router({ mergeParams: true });

router.post(
    '/',
    authMiddleware,
    representativeMiddleware,
    validate(createOfficialResponseSchema),
    createOfficialResponse
);

router.patch(
    '/',
    authMiddleware,
    representativeMiddleware,
    validate(updateOfficialResponseSchema),
    updateOfficialResponse
);

export default router;