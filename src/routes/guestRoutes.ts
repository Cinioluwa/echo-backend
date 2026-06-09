import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { sendGuestOtp, verifyGuestOtp, guestSurgePing } from '../controllers/guestController.js';
import guestAuthMiddleware from '../middleware/guestAuthMiddleware.js';

const router = Router();

// Rate limiters
const sendOtpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 sends per IP per hour
  message: { error: 'Too many OTP requests from this IP, please try again after an hour' },
});

const verifyOtpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 verify attempts per IP per hour
  message: { error: 'Too many verify attempts from this IP, please try again after an hour' },
});

/**
 * @openapi
 * /api/guest/otp/send:
 *   post:
 *     summary: Send OTP for guest verification
 *     tags:
 *       - Guest
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - pingId
 *             properties:
 *               email:
 *                 type: string
 *               pingId:
 *                 type: integer
 */
router.post('/otp/send', sendOtpLimiter, sendGuestOtp);

/**
 * @openapi
 * /api/guest/otp/verify:
 *   post:
 *     summary: Verify OTP and get guest JWT
 *     tags:
 *       - Guest
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *               - pingId
 *             properties:
 *               email:
 *                 type: string
 *               code:
 *                 type: string
 *               pingId:
 *                 type: integer
 */
router.post('/otp/verify', verifyOtpLimiter, verifyGuestOtp);

/**
 * @openapi
 * /api/guest/surge/{pingId}:
 *   post:
 *     summary: Surge a ping as a guest
 *     tags:
 *       - Guest
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pingId
 *         required: true
 *         schema:
 *           type: integer
 */
router.post('/surge/:pingId', guestAuthMiddleware, guestSurgePing);

export default router;
