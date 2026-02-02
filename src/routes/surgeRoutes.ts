// src/routes/surgeRoutes.ts
import { Router } from 'express';
import { toggleSurgeOnPing, toggleSurgeOnWave } from '../controllers/surgeController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { pingParamSchema, waveParamSchema } from '../schemas/waveSchemas.js';

/**
 * @openapi
 * /api/pings/{pingId}/surge:
 *   post:
 *     summary: Toggle surge (like) on a ping
 *     description: |
 *       Like or unlike a ping. Works as a toggle:
 *       - If user hasn't surged: creates a surge (like)
 *       - If user has already surged: removes the surge (unlike)
 *       
 *       **Authentication required**: User must be logged in.
 *       **Organization scoped**: Can only surge pings in user's organization.
 *       
 *       Surges help surface popular issues to the top of feeds.
 *     tags:
 *       - Surges
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pingId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the ping to surge
 *     responses:
 *       200:
 *         description: Surge toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Surge added
 *                 surged:
 *                   type: boolean
 *                   description: Whether the ping is now surged by user
 *                   example: true
 *                 surgeCount:
 *                   type: integer
 *                   description: New total surge count
 *                   example: 42
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ping not found
 *       500:
 *         description: Internal server error
 */

// Router for ping surges: /api/pings/:pingId/surge
export const pingSurgeRouter = Router({ mergeParams: true });
pingSurgeRouter.post('/', authMiddleware, organizationMiddleware, validate(pingParamSchema), toggleSurgeOnPing);  // Toggle surge on a ping (like/unlike)

/**
 * @openapi
 * /api/waves/{waveId}/surge:
 *   post:
 *     summary: Toggle surge (like) on a wave
 *     description: |
 *       Like or unlike a wave. Works as a toggle:
 *       - If user hasn't surged: creates a surge (like)
 *       - If user has already surged: removes the surge (unlike)
 *       
 *       **Authentication required**: User must be logged in.
 *       **Organization scoped**: Can only surge waves in user's organization.
 *       
 *       Surges help surface popular solutions.
 *     tags:
 *       - Surges
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: waveId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the wave to surge
 *     responses:
 *       200:
 *         description: Surge toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Surge added
 *                 surged:
 *                   type: boolean
 *                   description: Whether the wave is now surged by user
 *                   example: true
 *                 surgeCount:
 *                   type: integer
 *                   description: New total surge count
 *                   example: 15
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Wave not found
 *       500:
 *         description: Internal server error
 */

// Router for wave surges: /api/waves/:waveId/surge
export const waveSurgeRouter = Router({ mergeParams: true });
waveSurgeRouter.post('/', authMiddleware, organizationMiddleware, validate(waveParamSchema), toggleSurgeOnWave);  // Toggle surge on a wave (like/unlike)

// Default export for backward compatibility (wave surges)
export default waveSurgeRouter;