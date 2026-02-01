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
 * @openapi
 * /api/auth/google:
 *   post:
 *     summary: Authenticate with Google OAuth
 *     description: |
 *       Sign in or sign up using a Google ID token. This endpoint:
 *       - Verifies the Google token
 *       - Finds or creates a user account
 *       - Issues a JWT token for API access
 *       
 *       **New users** are automatically created with email pre-verified.
 *       **Existing users** can link their Google account on first Google sign-in.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Google ID token obtained from Google Sign-In
 *                 example: eyJhbGciOiJSUzI1NiIsImtpZCI6IjE...
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Google authentication successful
 *                 token:
 *                   type: string
 *                   description: JWT token for API access
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   allOf:
 *                     - $ref: '#/components/schemas/User'
 *                     - type: object
 *                       properties:
 *                         profilePicture:
 *                           type: string
 *                           nullable: true
 *                           description: Google profile picture URL
 *       400:
 *         description: Bad request - Invalid token or consumer email domain
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingToken:
 *                 value:
 *                   error: Google token is required
 *               consumerEmail:
 *                 value:
 *                   error: Please use your company email address. Consumer email domains are not allowed.
 *       401:
 *         description: Unauthorized - Invalid Google token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: Invalid Google token
 *       403:
 *         description: Forbidden - Organization not active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: Your organization is not active. Please contact support.
 *       404:
 *         description: Not Found - No organization for email domain
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: No organization found for domain example.edu. Please contact your administrator.
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: Internal server error during Google authentication
 */
router.post(
  '/google',
  validate(googleAuthSchema),
  googleAuth
);

export default router;
