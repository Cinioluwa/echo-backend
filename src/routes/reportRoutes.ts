import { Router } from 'express';
import {
  createReport,
  getReports,
  updateReportStatus,
} from '../controllers/reportController.js';
import adminMiddleware from '../middleware/adminMiddleware.js';
import authMiddleware from '../middleware/authMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  createReportSchema,
  listReportsSchema,
  updateReportStatusSchema,
} from '../schemas/reportSchemas.js';

const router = Router();

/**
 * @openapi
 * /api/reports:
 *   post:
 *     summary: Create a report
 *     description: Report a ping, wave, or comment for review.
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pingId:
 *                 type: integer
 *               waveId:
 *                 type: integer
 *               commentId:
 *                 type: integer
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Report created successfully
 *       400:
 *         description: Invalid input or reporting own content
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Target content not found
 *       409:
 *         description: Pending report already exists
 */
router.post('/', authMiddleware, organizationMiddleware, validate(createReportSchema), createReport);

/**
 * @openapi
 * /api/reports:
 *   get:
 *     summary: Get all reports
 *     description: Retrieve a paginated list of reports for the organization. Can be filtered by status.
 *     tags:
 *       - Reports
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, REVIEWED, RESOLVED, DISMISSED]
 *     responses:
 *       200:
 *         description: A list of reports
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 */
router.get('/', authMiddleware, adminMiddleware, organizationMiddleware, validate(listReportsSchema), getReports);

/**
 * @openapi
 * /api/reports/{id}/status:
 *   patch:
 *     summary: Update report status
 *     description: Update the status of a specific report.
 *     tags:
 *       - Reports
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, REVIEWED, RESOLVED, DISMISSED]
 *     responses:
 *       200:
 *         description: Report status updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 *       404:
 *         description: Report not found
 */
router.patch(
  '/:id/status',
  authMiddleware,
  adminMiddleware,
  organizationMiddleware,
  validate(updateReportStatusSchema),
  updateReportStatus,
);

export default router;
