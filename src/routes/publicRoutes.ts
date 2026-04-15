import { Router, type RequestHandler } from 'express';
import { getPublicPings, getPublicWaves, getPublicResolutionLog, getShareMetadata } from '../controllers/publicController.js';
import { inviteLeader } from '../controllers/organizationController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';
import cache from '../middleware/cacheMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { inviteLeaderSchema, shareMetadataAliasIdSchema, shareMetadataSchema } from '../schemas/publicSchemas.js';

const router = Router();

/**
 * @openapi
 * /api/public/share/{entity}/{id}:
 *   get:
 *     summary: Get safe metadata for share previews
 *     description: |
 *       Returns a strict, public-safe metadata payload for link previews and SEO metadata generation.
 *       This endpoint is intentionally unauthenticated so social crawlers can fetch metadata.
 *
 *       Supported entities:
 *       - `feed` (resolves ping first, then wave)
 *       - `ping`
 *       - `wave`
 *       - `comment`
 *
 *       **Security note**: Payload is intentionally minimal and excludes sensitive/private fields.
 *     tags:
 *       - Public
 *     parameters:
 *       - in: path
 *         name: entity
 *         required: true
 *         schema:
 *           type: string
 *           enum: [feed, ping, wave, comment]
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Share metadata returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                   enum: [ping, wave, comment]
 *                 id:
 *                   type: integer
 *                 title:
 *                   type: string
 *                 description:
 *                   type: string
 *                 imageUrl:
 *                   type: string
 *                   nullable: true
 *                 canonicalUrl:
 *                   type: string
 *       400:
 *         description: Invalid entity or id
 *       404:
 *         description: Content not found
 *       500:
 *         description: Internal server error
 */
router.get('/share/:entity/:id', validate(shareMetadataSchema), cache(300), getShareMetadata);

const withShareEntity = (entity: 'feed' | 'ping' | 'wave' | 'comment'): RequestHandler =>
	(req, _res, next) => {
		req.params.entity = entity;
		next();
	};

// Backward-compatible aliases for existing integration callers.
router.get('/feed/:id/metadata', validate(shareMetadataAliasIdSchema), withShareEntity('feed'), cache(300), getShareMetadata);
router.get('/comments/:id/metadata', validate(shareMetadataAliasIdSchema), withShareEntity('comment'), cache(300), getShareMetadata);
router.get('/pings/:id/metadata', validate(shareMetadataAliasIdSchema), withShareEntity('ping'), cache(300), getShareMetadata);
router.get('/waves/:id/metadata', validate(shareMetadataAliasIdSchema), withShareEntity('wave'), cache(300), getShareMetadata);

/**
 * @openapi
 * /api/public/soundboard:
 *   get:
 *     summary: Get public feed of pings (soundboard)
 *     description: |
 *       Retrieve a paginated, public-facing feed of pings in the user's organization.
 *       The "soundboard" displays issues and feedback from the community.
 *       
 *       **Authentication required**: User must be logged in.
 *       **Organization scoped**: Only shows pings from user's organization.
 *       
 *       **Sorting**:
 *       - `trending`: Sort by surge count (likes), then by creation date
 *       - `new`: Sort by creation date (most recent first) - default
 *       
 *       **Filtering**:
 *       - `category`: Filter by category ID (optional)
 *       - Omit category to show "All Categories"
 *       
 *       **Anonymous pings**: Author details are hidden for anonymous posts.
 *     tags:
 *       - Public
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [trending, new]
 *           default: new
 *         description: Sort order (trending = by likes, new = by date)
 *       - in: query
 *         name: category
 *         schema:
 *           type: integer
 *         description: Filter by category ID (optional, omit for all categories)
 *     responses:
 *       200:
 *         description: Soundboard feed retrieved successfully
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
 *       400:
 *         description: Bad request - Invalid category ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
// Soundboard (Pings) - now requires auth
router.get('/soundboard', authMiddleware, organizationMiddleware, cache(120, { perUser: true }), getPublicPings);

/**
 * @openapi
 * /api/public/stream:
 *   get:
 *     summary: Get public feed of waves (stream)
 *     description: |
 *       Retrieve a paginated, public-facing feed of waves (solutions) in the user's organization.
 *       The "stream" displays solutions and responses to community issues.
 *       
 *       **Authentication required**: User must be logged in.
 *       **Organization scoped**: Only shows waves from user's organization.
 *       
 *       Supports same sorting and filtering options as soundboard.
 *     tags:
 *       - Public
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [trending, new]
 *           default: new
 *       - in: query
 *         name: category
 *         schema:
 *           type: integer
 *         description: Filter waves by parent ping's category ID
 *     responses:
 *       200:
 *         description: Stream feed retrieved successfully
 *       400:
 *         description: Bad request - Invalid category ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
// Stream (Waves) - now requires auth
router.get('/stream', authMiddleware, organizationMiddleware, cache(30, { perUser: true }), getPublicWaves);

/**
 * @openapi
 * /api/public/resolution-log:
 *   get:
 *     summary: Get feed of resolved pings
 *     description: |
 *       Retrieve a paginated feed of recently resolved pings.
 *       Shows issues that have been marked as resolved within a specified timeframe.
 *       
 *       **Authentication required**: User must be logged in.
 *       **Organization scoped**: Only shows resolved pings from user's organization.
 *     tags:
 *       - Public
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: days
 *         schema:
 *           type: string
 *         description: Filter by resolved within last N days (1-365) or 'all' for all time
 *         example: 7
 *         default: 7
 *     responses:
 *       200:
 *         description: Resolution log retrieved successfully
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
 *       500:
 *         description: Internal server error
 */
// Resolution Log (resolved pings) - now requires auth
router.get('/resolution-log', authMiddleware, organizationMiddleware, cache(60, { perUser: true }), getPublicResolutionLog);

/**
 * @openapi
 * /api/public/organizations/{id}/invite-leader:
 *   post:
 *     summary: Invite a potential leader to claim an organization
 *     description: |
 *       Allows any authenticated user to send an invitation email to a potential leader
 *       to claim and lead a specific organization.
 *       
 *       **Authentication required**: User must be logged in.
 *     tags:
 *       - Public
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: potential.leader@example.com
 *     responses:
 *       201:
 *         description: Invitation sent successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Internal server error
 */
router.post('/organizations/:id/invite-leader', authMiddleware, validate(inviteLeaderSchema), inviteLeader);

export default router;
