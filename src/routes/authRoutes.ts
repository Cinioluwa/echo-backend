// src/routes/authRoutes.ts
import express from 'express';
import { googleAuth } from '../controllers/googleAuthController.js';
import { validate } from '../middleware/validationMiddleware.js';
import { z } from 'zod';

const router = express.Router();

const googleAuthSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Google token is required'),
  }),
});

/**
 * POST /api/auth/google
 * Authenticate user with Google ID token
 */
router.post(
  '/google',
  validate(googleAuthSchema),
  googleAuth
);

export default router;
