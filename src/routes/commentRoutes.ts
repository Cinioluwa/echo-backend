import { Router } from 'express';
import { 
  createCommentOnPing, 
  getCommentsForPing,
  createCommentOnWave, 
  getCommentsForWave 
} from '../controllers/commentController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { 
  createCommentOnPingSchema,
  getCommentsForPingSchema,
  createCommentOnWaveSchema,
  getCommentsForWaveSchema
} from '../schemas/commentSchemas.js';

// Two separate routers for different parent routes

/**
 * @openapi
 * /api/pings/{pingId}/comments:
 *   post:
 *     summary: Create a comment on a ping
 *     description: |
 *       Add a comment to a specific ping (issue).
 *       
 *       **Authentication required**: User must be logged in.
 *       **Organization scoped**: Comment is created in user's organization.
 *     tags:
 *       - Comments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pingId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the ping to comment on
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
 *                 description: Comment text
 *                 example: I've experienced this issue too. It's been happening for about a week.
 *               isAnonymous:
 *                 type: boolean
 *                 description: Whether to post anonymously
 *                 default: false
 *     responses:
 *       201:
 *         description: Comment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       400:
 *         description: Bad request - Missing content
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ping not found
 *       500:
 *         description: Internal server error
 *   get:
 *     summary: Get all comments for a ping
 *     description: |
 *       Retrieve all comments on a specific ping.
 *       
 *       **Authentication required**: User must be logged in.
 *       
 *       Comments are returned sorted by creation date (oldest first for conversation flow).
 *     tags:
 *       - Comments
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
 *         description: List of comments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Comment'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ping not found
 *       500:
 *         description: Internal server error
 */

// Router for ping comments: /api/pings/:pingId/comments
export const pingCommentRouter = Router({ mergeParams: true });

pingCommentRouter.route('/')
  .post(authMiddleware, organizationMiddleware, validate(createCommentOnPingSchema), createCommentOnPing)  // Create a comment on a ping
  .get(authMiddleware, organizationMiddleware, validate(getCommentsForPingSchema), getCommentsForPing);                    // Get all comments for a ping

/**
 * @openapi
 * /api/waves/{waveId}/comments:
 *   post:
 *     summary: Create a comment on a wave
 *     description: |
 *       Add a comment to a specific wave (solution).
 *       
 *       **Authentication required**: User must be logged in.
 *       **Organization scoped**: Comment is created in user's organization.
 *     tags:
 *       - Comments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: waveId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the wave to comment on
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
 *                 description: Comment text
 *                 example: Great solution! I think this would really help.
 *               isAnonymous:
 *                 type: boolean
 *                 description: Whether to post anonymously
 *                 default: false
 *     responses:
 *       201:
 *         description: Comment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       400:
 *         description: Bad request - Missing content
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Wave not found
 *       500:
 *         description: Internal server error
 *   get:
 *     summary: Get all comments for a wave
 *     description: |
 *       Retrieve all comments on a specific wave.
 *       
 *       **Authentication required**: User must be logged in.
 *       
 *       Comments are returned sorted by creation date (oldest first).
 *     tags:
 *       - Comments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: waveId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the wave
 *     responses:
 *       200:
 *         description: List of comments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Comment'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Wave not found
 *       500:
 *         description: Internal server error
 */

// Router for wave comments: /api/waves/:waveId/comments
export const waveCommentRouter = Router({ mergeParams: true });

waveCommentRouter.route('/')
  .post(authMiddleware, organizationMiddleware, validate(createCommentOnWaveSchema), createCommentOnWave)  // Create a comment on a wave
  .get(authMiddleware, organizationMiddleware, validate(getCommentsForWaveSchema), getCommentsForWave);                    // Get all comments for a wave

// Default export for backward compatibility (wave comments)
export default waveCommentRouter;