import { Router } from 'express';
import { getSubmittedPings, getTopWavesForReview, forwardWaves } from '../controllers/representativeController.js' ;
import authMiddleware from '../middleware/authMiddleware.js';
import representativeMiddleware from '../middleware/representativeMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';
// Add:
import { validate } from '../middleware/validationMiddleware.js';
import { paginationSchema } from '../schemas/paginationSchema.js';

const router = Router();

/**
 * @openapi
 * /api/representative/pings/submitted:
 *   get:
 *     summary: Get pings submitted for review
 *     description: |
 *       Retrieve pings that have been submitted for representative review.
 *       These are pings that students want to escalate to administration.
 *       
 *       **Representative/Admin only**: Requires REPRESENTATIVE or ADMIN role.
 *     tags:
 *       - Representative
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of submitted pings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Ping'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Representative access required
 *       500:
 *         description: Internal server error
 */
router.get(
  '/pings/submitted',
  authMiddleware,
  representativeMiddleware,
  organizationMiddleware,
  validate(paginationSchema),
  getSubmittedPings
);

/**
 * @openapi
 * /api/representative/waves/top:
 *   get:
 *     summary: Get top waves for review
 *     description: |
 *       Get the top-rated waves that representatives should review.
 *       Waves with high surge counts are prioritized.
 *       
 *       **Representative/Admin only**: Requires REPRESENTATIVE or ADMIN role.
 *     tags:
 *       - Representative
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of top waves
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Wave'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Representative access required
 *       500:
 *         description: Internal server error
 */
// Additional representative endpoints
router.get(
  '/waves/top',
  authMiddleware,
  representativeMiddleware,
  organizationMiddleware,
  getTopWavesForReview
);

/**
 * @openapi
 * /api/representative/waves/forward:
 *   post:
 *     summary: Forward waves for admin review
 *     description: |
 *       Flag selected waves for administrative review.
 *       This escalates promising solutions to decision-makers.
 *       
 *       **Representative/Admin only**: Requires REPRESENTATIVE or ADMIN role.
 *     tags:
 *       - Representative
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - waveIds
 *             properties:
 *               waveIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: IDs of waves to forward
 *                 example: [1, 2, 3]
 *     responses:
 *       200:
 *         description: Waves forwarded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 3 waves forwarded for review
 *                 forwarded:
 *                   type: integer
 *                   example: 3
 *       400:
 *         description: Invalid wave IDs
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Representative access required
 *       500:
 *         description: Internal server error
 */
router.post(
  '/waves/forward',
  authMiddleware,
  representativeMiddleware,
  organizationMiddleware,
  forwardWaves
);

export default router;