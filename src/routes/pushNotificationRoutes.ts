import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  subscribe,
  unsubscribe,
  getVapidPublicKey,
} from '../controllers/pushNotificationController.js';

const router = Router();

router.post('/subscribe', requireAuth, subscribe);
router.delete('/unsubscribe', requireAuth, unsubscribe);
router.get('/vapid-public-key', getVapidPublicKey);

export default router;
