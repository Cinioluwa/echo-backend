// src/routes/analyticsRoutes.ts
import { Router } from 'express';
import { getAdminOverview, getCategoryAnalytics, getPingLevelAnalytics } from '../controllers/analyticsController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';

const router = Router();

/**
 * @openapi
 * /api/analytics/admin/overview:
 *   get:
 *     summary: Get admin overview analytics
 *     description: |
 *       Returns top-level metrics for the organization, including dynamic percentage 
 *       change (30-day window) and a 6-month year-over-year line chart data breakdown.
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin overview retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summaryCards:
 *                   type: object
 *                   properties:
 *                     waves:
 *                       $ref: '#/components/schemas/AnalyticsSummary'
 *                     pings:
 *                       $ref: '#/components/schemas/AnalyticsSummary'
 *                     wavesUnderReview:
 *                       $ref: '#/components/schemas/AnalyticsSummary'
 *                     activeUsers:
 *                       $ref: '#/components/schemas/AnalyticsSummary'
 *                 chartData:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       month:
 *                         type: string
 *                         example: "Mar"
 *                       thisYear:
 *                         $ref: '#/components/schemas/MonthlyAnalytics'
 *                       lastYear:
 *                         $ref: '#/components/schemas/MonthlyAnalytics'
 */
router.get('/admin/overview', authMiddleware, organizationMiddleware, getAdminOverview);

/**
 * @openapi
 * /api/analytics/admin/categories:
 *   get:
 *     summary: Get category-based analytics
 *     description: Returns a breakdown of Pings, Waves, and Resolved items grouped by their category.
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalPings:
 *                   type: integer
 *                 totalWaves:
 *                   type: integer
 *                 totalResolvedPings:
 *                   type: integer
 *                 categories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       category:
 *                         type: string
 *                       pings:
 *                         $ref: '#/components/schemas/CategoryMetric'
 *                       waves:
 *                         $ref: '#/components/schemas/CategoryMetric'
 *                       resolvedPings:
 *                         $ref: '#/components/schemas/CategoryMetric'
 */
router.get('/admin/categories', authMiddleware, organizationMiddleware, getCategoryAnalytics);

/**
 * @openapi
 * /api/analytics/pings/{id}/levels:
 *   get:
 *     summary: Get user level distribution for a specific ping
 *     description: Returns a breakdown of interactions (surges, comments, waves) on a single ping, grouped by the user levels.
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ping ID
 *     responses:
 *       200:
 *         description: Ping level analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalSurges:
 *                   type: integer
 *                 surgeBreakdown:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LevelMetric'
 *                 totalComments:
 *                   type: integer
 *                 commentBreakdown:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LevelMetric'
 *                 totalWaves:
 *                   type: integer
 *                 waveBreakdown:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LevelMetric'
 */
router.get('/pings/:id/levels', authMiddleware, organizationMiddleware, getPingLevelAnalytics);

export default router;

