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

router.post('/', authMiddleware, organizationMiddleware, validate(createReportSchema), createReport);

router.get('/', authMiddleware, adminMiddleware, organizationMiddleware, validate(listReportsSchema), getReports);

router.patch(
  '/:id/status',
  authMiddleware,
  adminMiddleware,
  organizationMiddleware,
  validate(updateReportStatusSchema),
  updateReportStatus,
);

export default router;
