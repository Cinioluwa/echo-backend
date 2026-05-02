import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  subscribe,
  unsubscribe,
  getVapidPublicKey,
} from '../controllers/pushNotificationController.js';

const router = Router();

router.post('/subscribe', authMiddleware, subscribe);
router.delete('/unsubscribe', authMiddleware, unsubscribe);
router.get('/vapid-public-key', getVapidPublicKey);

export default router;
