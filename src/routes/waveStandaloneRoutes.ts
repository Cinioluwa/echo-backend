import { Router } from 'express';
import { getWaveById, updateWave, deleteWave } from '../controllers/waveController.js';
import { validate } from '../middleware/validationMiddleware.js';
import { waveIdParamSchema, updateWaveSchema } from '../schemas/waveSchemas.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';
import { cache } from '../middleware/cacheMiddleware.js';

const waveStandaloneRouter = Router();

/**
 * @openapi
 * /api/waves/{id}:
 *   get:
 *     summary: Get a specific wave by ID
 *     description: |
 *       Retrieve detailed information about a specific wave (solution).
 *       
 *       **Authentication required**: User must be logged in.
 *       **Organization scoped**: Can only view waves from user's organization.
 *       
 *       Includes author info (unless anonymous), surge count, comments count, and parent ping reference.
 *     tags:
 *       - Waves
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Wave ID
 *     responses:
 *       200:
 *         description: Wave details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Wave'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Wave not found
 *       500:
 *         description: Internal server error
 *   patch:
 *     summary: Update a wave
 *     description: |
 *       Update the content of a wave. Only the original author can update their wave.
 *       
 *       **Authorization**: Only the wave author can update it.
 *     tags:
 *       - Waves
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Wave ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               solution:
 *                 type: string
 *                 description: Updated solution text
 *                 example: Updated solution with better WiFi boosters and mesh network
 *     responses:
 *       200:
 *         description: Wave updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Wave'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to update this wave
 *       404:
 *         description: Wave not found
 *       500:
 *         description: Internal server error
 *   delete:
 *     summary: Delete a wave
 *     description: |
 *       Delete a wave. Only the original author or an admin can delete a wave.
 *       
 *       **Authorization**: Wave author or Admin only.
 *       
 *       **Warning**: This also deletes all associated comments and surges.
 *     tags:
 *       - Waves
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Wave ID
 *     responses:
 *       200:
 *         description: Wave deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Wave deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to delete this wave
 *       404:
 *         description: Wave not found
 *       500:
 *         description: Internal server error
 */

// GET /api/waves/:id - Get a specific wave by ID - cached for 60s
waveStandaloneRouter.get('/:id', authMiddleware, organizationMiddleware, validate(waveIdParamSchema), cache(60), getWaveById);

// PATCH /api/waves/:id - Update a wave
waveStandaloneRouter.patch('/:id', authMiddleware, organizationMiddleware, validate(waveIdParamSchema), validate(updateWaveSchema), updateWave);

// DELETE /api/waves/:id - Delete a wave
waveStandaloneRouter.delete('/:id', authMiddleware, organizationMiddleware, validate(waveIdParamSchema), deleteWave);

export default waveStandaloneRouter;
