import { Router } from 'express';
import { getSubmittedPings, getTopWavesForReview, forwardWaves } from '../controllers/representativeController.js' ;
import authMiddleware from '../middleware/authMiddleware.js';
import representativeMiddleware from '../middleware/representativeMiddleware.js';
import organizationMiddleware from '../middleware/organizationMiddleware.js';
// Add:
import { validate } from '../middleware/validationMiddleware.js';
import { paginationSchema } from '../schemas/paginationSchema.js';

const router = Router();

router.get(
  '/pings/submitted',
  authMiddleware,
  representativeMiddleware,
  organizationMiddleware,
  validate(paginationSchema),
  getSubmittedPings
);

export default router;
// Additional representative endpoints
router.get(
  '/waves/top',
  authMiddleware,
  representativeMiddleware,
  organizationMiddleware,
  getTopWavesForReview
);

router.post(
  '/waves/forward',
  authMiddleware,
  representativeMiddleware,
  organizationMiddleware,
  forwardWaves
);