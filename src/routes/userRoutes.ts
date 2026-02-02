// src/routes/userRoutes.ts
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { 
  registerUser, 
  loginUser, 
  loginWithGoogle,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  requestOrganizationOnboarding,
  deleteCurrentUser, 
  updateCurrentUser, 
  getCurrentUser,
  getMySurges,
  getMyComments
} from '../controllers/userController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { env } from '../config/env.js';
import { 
  registerSchema, 
  loginSchema, 
  updateUserSchema, 
  googleAuthSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  organizationWaitlistSchema,
} from '../schemas/userSchemas.js';

const router = Router();

/**
 * @openapi
 * /api/users/register:
 *   post:
 *     summary: Register a new user account
 *     description: |
 *       Create a new user account. The user's organization is determined by their email domain.
 *       
 *       **Flow:**
 *       1. Validates email format and password requirements
 *       2. Extracts domain from email to find matching organization
 *       3. Creates user with PENDING status
 *       4. Sends verification email with token link
 *       
 *       **Password requirements:** Minimum 8 characters
 *       
 *       **Note:** User must verify email before they can log in.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Must be from an organization's registered domain
 *                 example: student@university.edu
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Minimum 8 characters
 *                 example: SecurePass123!
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *     responses:
 *       201:
 *         description: User registered successfully. Check email for verification link.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Registration successful. Please check your email to verify your account.
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request - Invalid input or email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               emailExists:
 *                 value:
 *                   error: User already exists
 *               invalidEmail:
 *                 value:
 *                   error: Invalid email format
 *       404:
 *         description: No organization found for email domain
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
// Register a new user - with validation
router.post('/register', validate(registerSchema), registerUser);

/**
 * @openapi
 * /api/users/login:
 *   post:
 *     summary: Login with email and password
 *     description: |
 *       Authenticate a user with their email and password.
 *       
 *       **Requirements:**
 *       - User must have verified their email
 *       - User's organization must be ACTIVE
 *       - Password must match
 *       
 *       **Returns:** JWT token valid for 24 hours
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: student@university.edu
 *               password:
 *                 type: string
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 token:
 *                   type: string
 *                   description: JWT token for API authentication
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials or email not verified
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalidCredentials:
 *                 value:
 *                   error: Invalid credentials
 *               notVerified:
 *                 value:
 *                   error: Please verify your email before logging in
 *       403:
 *         description: Organization not active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
// Login a user - with validation
router.post('/login', validate(loginSchema), loginUser);

/**
 * @openapi
 * /api/users/google:
 *   post:
 *     summary: Login or register with Google OAuth
 *     description: |
 *       Authenticate using a Google ID token. Creates a new account if the user doesn't exist.
 *       
 *       **Note:** This is a legacy endpoint. Prefer using `/api/auth/google` for new integrations.
 *     tags:
 *       - Users
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
 *                 description: Google ID token from Google Sign-In
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid token or consumer email
 *       401:
 *         description: Invalid Google token
 *       404:
 *         description: No organization for email domain
 *       500:
 *         description: Internal server error
 */
// Google OAuth login
router.post('/google', validate(googleAuthSchema), loginWithGoogle);

/**
 * @openapi
 * /api/users/verify-email:
 *   get:
 *     summary: Verify email via link (browser redirect)
 *     description: |
 *       Verify a user's email address by clicking the link sent to their email.
 *       This endpoint is designed for browser use - it redirects to the app after verification.
 *       
 *       **Note:** For API/Postman usage, use the POST version instead.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Email verification token from the email link
 *     responses:
 *       302:
 *         description: Redirects to app URL after successful verification
 *       400:
 *         description: Invalid or expired token
 *   post:
 *     summary: Verify email via API
 *     description: |
 *       Verify a user's email address using a verification token.
 *       Use this endpoint for API/programmatic verification.
 *     tags:
 *       - Users
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
 *                 description: Email verification token
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
// Email verification (Browser Link Support - Option B)
// This GET route allows users to verify email by clicking the link directly
router.get('/verify-email', 
  // 1. Move token from query string to body for validation
  (req: Request, res: Response, next: NextFunction) => {
    if (req.query.token) {
      req.body = { ...req.body, token: req.query.token };
    }
    next();
  },
  // 2. Validate token
  validate(verifyEmailSchema),
  // 3. Call controller but redirect instead of returning JSON
  async (req: Request, res: Response, next: NextFunction) => {
    // Override json method to redirect instead of sending JSON
    const originalJson = res.json.bind(res);
    res.json = function(body: unknown) {
      const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
      // Redirect to clean login URL (frontend doesn't need the query param)
      const redirectUrl = isSuccess 
        ? `${env.APP_URL}`
        : `${env.APP_URL}`;  // Could redirect to an error page if needed
      return res.redirect(redirectUrl);
    } as typeof res.json;

    try {
      await verifyEmail(req, res, next);
    } catch (err) {
      next(err);
    }
  }
);

// Email verification (API - for Postman/Frontend)
router.post('/verify-email', validate(verifyEmailSchema), verifyEmail);

/**
 * @openapi
 * /api/users/forgot-password:
 *   post:
 *     summary: Request password reset email
 *     description: |
 *       Send a password reset link to the user's email address.
 *       
 *       **Security:** Always returns success even if email doesn't exist to prevent user enumeration.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: student@university.edu
 *     responses:
 *       200:
 *         description: Password reset email sent (if user exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: If an account with that email exists, a password reset link has been sent.
 *       400:
 *         description: Invalid email format
 *       500:
 *         description: Internal server error
 */
// Password reset flow
router.post('/forgot-password', validate(forgotPasswordSchema), requestPasswordReset);

/**
 * @openapi
 * /api/users/reset-password:
 *   patch:
 *     summary: Reset password with token
 *     description: |
 *       Reset the user's password using the token received via email.
 *       
 *       **Token validity:** 1 hour
 *       **Password requirements:** Minimum 8 characters
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *                 description: Password reset token from email
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: New password (minimum 8 characters)
 *                 example: NewSecurePass123!
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password has been reset successfully
 *       400:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.patch('/reset-password', validate(resetPasswordSchema), resetPassword);

/**
 * @openapi
 * /api/users/organization-waitlist:
 *   post:
 *     summary: Request organization onboarding
 *     description: |
 *       Submit a request to add a new organization to the platform.
 *       This is for users whose organization (school/company) is not yet registered.
 *       
 *       **Flow:**
 *       1. User submits their organization details
 *       2. Request is reviewed by super admins
 *       3. If approved, organization is created and user can register
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - organizationName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Contact email (must be from the organization's domain)
 *                 example: admin@newschool.edu
 *               organizationName:
 *                 type: string
 *                 description: Name of the organization
 *                 example: New School University
 *               additionalInfo:
 *                 type: string
 *                 description: Additional context about the request
 *                 example: We have 5000 students and would love to use Echo
 *     responses:
 *       201:
 *         description: Request submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Your request has been submitted. We'll contact you once reviewed.
 *       400:
 *         description: Invalid input or duplicate request
 *       500:
 *         description: Internal server error
 */
// New organization onboarding request
router.post(
  '/organization-waitlist',
  validate(organizationWaitlistSchema),
  requestOrganizationOnboarding
);

/**
 * @openapi
 * /api/users/me:
 *   get:
 *     summary: Get current user profile
 *     description: |
 *       Retrieve the authenticated user's profile information including
 *       organization details and role.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/User'
 *                 - type: object
 *                   properties:
 *                     organization:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         name:
 *                           type: string
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       500:
 *         description: Internal server error
 *   patch:
 *     summary: Update current user profile
 *     description: |
 *       Update the authenticated user's profile information.
 *       Currently supports updating firstName and lastName.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Profile updated successfully
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *   delete:
 *     summary: Delete current user account
 *     description: |
 *       Permanently delete the authenticated user's account.
 *       
 *       **Warning:** This action is irreversible. All user data will be deleted.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Account deleted successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
// Current user routes (get, update, delete profile)
router.route('/me')
  .get(authMiddleware, getCurrentUser)                                   // Get current user profile
  .patch(authMiddleware, validate(updateUserSchema), updateCurrentUser)  // Update profile (firstName/lastName) - with validation
  .delete(authMiddleware, deleteCurrentUser);                            // Delete account

/**
 * @openapi
 * /api/users/me/surges:
 *   get:
 *     summary: Get all items I've surged (liked)
 *     description: |
 *       Retrieve all pings and waves that the authenticated user has surged (liked).
 *       Useful for showing a "My Likes" or "Saved" section.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of surged items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Ping'
 *                 waves:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Wave'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
// User activity routes (must come after /me to avoid route conflicts)
router.get('/me/surges', authMiddleware, getMySurges);      // Get all my surges (likes)

/**
 * @openapi
 * /api/users/me/comments:
 *   get:
 *     summary: Get all comments I've made
 *     description: |
 *       Retrieve all comments the authenticated user has posted.
 *       Includes comments on both pings and waves.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's comments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Comment'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/me/comments', authMiddleware, getMyComments);  // Get all my comments

export default router;