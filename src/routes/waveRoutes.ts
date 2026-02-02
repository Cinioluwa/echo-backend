import { Router } from 'express';
import { 
    createWave,
    getWavesForPing
} from '../controllers/waveController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { createWaveSchema, pingParamSchema } from '../schemas/waveSchemas.js';
import { cache } from '../middleware/cacheMiddleware.js';

// { mergeParams: true } is crucial for accessing :pingId from parent router
const router = Router({ mergeParams: true });

/**
 * @openapi
 * /api/pings/{pingId}/waves:
 *   post:
 *     summary: Create a wave (solution) for a ping
 *     description: |
 *       Submit a solution or response (wave) to a specific ping (issue).
 *       
 *       **Authentication required**: User must be logged in.
 *       **Organization scoped**: Wave is created in user's organization.
 *       
 *       Waves represent proposed solutions, ideas, or responses to issues raised in pings.
 *     tags:
 *       - Waves
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pingId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the ping to respond to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - solution
 *             properties:
 *               solution:
 *                 type: string
 *                 description: The proposed solution or response
 *                 example: We could install WiFi signal boosters in the library to improve connectivity.
 *               isAnonymous:
 *                 type: boolean
 *                 description: Whether to post anonymously
 *                 default: false
 *     responses:
 *       201:
 *         description: Wave created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Wave'
 *       400:
 *         description: Bad request - Missing solution or invalid pingId
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ping not found
 *       500:
 *         description: Internal server error
 *   get:
 *     summary: Get all waves for a ping
 *     description: |
 *       Retrieve all waves (solutions) submitted for a specific ping.
 *       
 *       **Authentication required**: User must be logged in.
 *       **Organization scoped**: Only shows waves from user's organization.
 *       
 *       Results are sorted by creation date (newest first) by default.
 *     tags:
 *       - Waves
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pingId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the ping
 *     responses:
 *       200:
 *         description: List of waves for the ping
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Wave'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ping not found
 *       500:
 *         description: Internal server error
 */

// POST /api/pings/:pingId/waves - Create a wave for a ping
router.post('/', authMiddleware, organizationMiddleware, validate(createWaveSchema), createWave);

// GET /api/pings/:pingId/waves - Get all waves for a ping - cached for 60s
router.get('/', authMiddleware, organizationMiddleware, validate(pingParamSchema), cache(60), getWavesForPing);

// Standalone wave-by-id route will be mounted separately at /api/waves/:id

export default router;