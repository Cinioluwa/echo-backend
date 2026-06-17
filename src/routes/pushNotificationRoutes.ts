import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  subscribe,
  unsubscribe,
  getVapidPublicKey,
} from '../controllers/pushNotificationController.js';

const router = Router();

/**
 * @openapi
 * /api/notifications/push/subscribe:
 *   post:
 *     summary: Subscribe to push notifications
 *     description: Subscribes the current user to push notifications by saving their web push subscription.
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - endpoint
 *               - keys
 *             properties:
 *               endpoint:
 *                 type: string
 *               keys:
 *                 type: object
 *                 properties:
 *                   p256dh:
 *                     type: string
 *                   auth:
 *                     type: string
 *     responses:
 *       201:
 *         description: Successfully subscribed to push notifications
 *       401:
 *         description: Unauthorized
 */
router.post('/subscribe', authMiddleware, subscribe);
/**
 * @openapi
 * /api/notifications/push/unsubscribe:
 *   delete:
 *     summary: Unsubscribe from push notifications
 *     description: Unsubscribes the current user from push notifications by removing their web push subscription based on the provided endpoint.
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - endpoint
 *             properties:
 *               endpoint:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully unsubscribed
 *       401:
 *         description: Unauthorized
 */
router.delete('/unsubscribe', authMiddleware, unsubscribe);
/**
 * @openapi
 * /api/notifications/push/vapid-public-key:
 *   get:
 *     summary: Get VAPID public key
 *     description: Retrieves the VAPID public key required to subscribe to web push notifications.
 *     tags:
 *       - Notifications
 *     responses:
 *       200:
 *         description: Returns the VAPID public key
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 publicKey:
 *                   type: string
 */
router.get('/vapid-public-key', getVapidPublicKey);

export default router;
