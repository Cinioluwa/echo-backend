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

// Router for ping comments: /api/pings/:pingId/comments
export const pingCommentRouter = Router({ mergeParams: true });

pingCommentRouter.route('/')
  .post(authMiddleware, organizationMiddleware, validate(createCommentOnPingSchema), createCommentOnPing)  // Create a comment on a ping
  .get(authMiddleware, organizationMiddleware, validate(getCommentsForPingSchema), getCommentsForPing);                    // Get all comments for a ping

// Router for wave comments: /api/waves/:waveId/comments
export const waveCommentRouter = Router({ mergeParams: true });

waveCommentRouter.route('/')
  .post(authMiddleware, organizationMiddleware, validate(createCommentOnWaveSchema), createCommentOnWave)  // Create a comment on a wave
  .get(authMiddleware, organizationMiddleware, validate(getCommentsForWaveSchema), getCommentsForWave);                    // Get all comments for a wave

// Default export for backward compatibility (wave comments)
export default waveCommentRouter;