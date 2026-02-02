import { Router } from 'express';
import { createOfficialResponse, updateOfficialResponse } from '../controllers/officialResponseController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import representativeMiddleware from '../middleware/representativeMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { createOfficialResponseSchema, updateOfficialResponseSchema } from '../schemas/officialResponseSchemas.js';

const router = Router({ mergeParams: true });

/**
 * @openapi
 * /api/pings/{pingId}/official-response:
 *   post:
 *     summary: Create an official response for a ping
 *     description: |
 *       Add an official response from a representative or admin to a ping.
 *       
 *       Each ping can only have ONE official response. Use PATCH to update.
 *       
 *       **Representative/Admin only**: Requires REPRESENTATIVE or ADMIN role.
 *     tags:
 *       - Official Responses
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Official response text
 *                 example: Thank you for reporting this issue. We have contacted the IT department and they will be installing new WiFi boosters next week.
 *     responses:
 *       201:
 *         description: Official response created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OfficialResponse'
 *       400:
 *         description: Ping already has an official response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: This ping already has an official response
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Representative or Admin access required
 *       404:
 *         description: Ping not found
 *       500:
 *         description: Internal server error
 *   patch:
 *     summary: Update an official response
 *     description: |
 *       Update the official response for a ping.
 *       
 *       **Representative/Admin only**: Only the original author or an admin can update.
 *     tags:
 *       - Official Responses
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pingId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the ping
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Updated response text
 *     responses:
 *       200:
 *         description: Official response updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OfficialResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to update this response
 *       404:
 *         description: Official response not found
 *       500:
 *         description: Internal server error
 */

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