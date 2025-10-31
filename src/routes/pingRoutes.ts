import { Router } from 'express';
import { 
    createPing,
    getAllPings,
    searchPings,
    getMyPings,
    getPingById,
    deletePing,
    updatePing,
    updatePingStatus,
    submitPing
} from '../controllers/pingController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';
import adminMiddleware from '../middleware/adminMiddleware.js';
import representativeMiddleware from '../middleware/representativeMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { createPingSchema, updatePingSchema, pingIdSchema } from '../schemas/pingSchemas.js';
import { paginationSchema, paginationWithFiltersSchema, searchSchema } from '../schemas/paginationSchema.js';

const router = Router();

// Create a new ping - with validation
router.post('/', authMiddleware, organizationMiddleware, validate(createPingSchema), createPing);

// Get all pings (with pagination and optional filters)
router.get('/', validate(paginationWithFiltersSchema), getAllPings);

// Search pings by hashtag or text query (must come BEFORE /:id route)
router.get('/search', validate(searchSchema), searchPings);

// Get current user's pings (must come BEFORE /:id route)
router.get('/me', authMiddleware, validate(paginationSchema), getMyPings);

// Get a specific ping by ID - with ID validation
router.get('/:id', validate(pingIdSchema), getPingById);

// Delete a ping - with ID validation
router.delete('/:id', authMiddleware, validate(pingIdSchema), deletePing);

// Update a ping - with ID and body validation
router.patch('/:id', authMiddleware, validate(pingIdSchema), validate(updatePingSchema), updatePing);

// Update ping status (admin only) - with ID validation
router.patch('/:id/status', authMiddleware, adminMiddleware, validate(pingIdSchema), updatePingStatus);

router.patch('/:id/submit', authMiddleware, representativeMiddleware, validate(pingIdSchema), submitPing);

export default router;