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
  requestOrganizationAdminAccess,
  listOrganizationsForOnboarding,
  submitOrganizationClaim,
  deleteCurrentUser, 
  updateCurrentUser, 
  getCurrentUser,
  getMySurges,
  getMyComments,
  getMyAnalytics,
  changePassword,
  getUserPublicProfile,
} from '../controllers/userController.js';
import {
  getMyNotificationPreferences,
  patchMyNotificationPreferences,
} from '../controllers/notificationPreferenceController.js';
import {
  getMyPreferences,
  patchMyPreferences,
} from '../controllers/userPreferenceController.js';
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
  onboardingOrganizationLookupSchema,
  organizationAdminAccessSchema,
  organizationClaimSchema,
  changePasswordSchema,
  userAnalyticsSchema,
  userIdParamSchema,
} from '../schemas/userSchemas.js';
import {
  getNotificationPreferencesSchema,
  patchNotificationPreferencesSchema,
} from '../schemas/notificationPreferenceSchemas.js';
import {
  getUserPreferencesSchema,
  patchUserPreferencesSchema,
} from '../schemas/userPreferenceSchemas.js';

const router = Router();

/**
 * @openapi
 * /api/users/organizations:
 *   get:
 *     summary: List organizations for onboarding selection
 *     description: |
 *       Returns active organizations for selection-only onboarding.
 *       If no match is found in the UI, users should submit `/organization-waitlist`
 *       instead of creating organizations directly.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: query
 *         required: false
 *         schema:
 *           type: string
 *         description: Case-insensitive search by organization name or domain
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 25
 *     responses:
 *       200:
 *         description: Organization list returned
 */
router.get('/organizations', validate(onboardingOrganizationLookupSchema), listOrganizationsForOnboarding);

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
 *               department:
 *                 type: string
 *                 description: Academic department
 *                 example: Computer Science
 *               hall:
 *                 type: string
 *                 description: Residential hall
 *                 example: Eni-Njoku Hall
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
 *       - Personal email domains (for example gmail.com) must include `organizationId`
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
 *               organizationId:
 *                 type: integer
 *                 description: Required when logging in with a personal email domain (for example gmail.com)
 *                 example: 1
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
 *       Submit a reviewed request to add a new organization to the platform.
 *       This endpoint does not create an organization immediately.
 *       It queues the request for super-admin approval.
 *       
 *       **Flow:**
 *       1. User submits their organization details
 *       2. Request is reviewed by super admins
 *       3. If approved, organization is created and users can register
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
 *               metadata:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Optional review metadata/context for admins
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
 *                   example: Organization request received. Your request will be reviewed by platform admins.
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
 * /api/users/organizations/{id}/claim:
 *   post:
 *     summary: Submit leadership claim for a preseeded organization
 *     description: |
 *       Submit a claim request to become the verified organization leader/admin
 *       for a preseeded organization.
 *
 *       **Guardrails:**
 *       - Request email domain must exactly match the organization's configured domain.
 *       - Open-domain organizations are not claimable through this endpoint.
 *       - Duplicate pending claims from the same user are rejected.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - firstName
 *               - lastName
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: staff@cu.edu.ng
 *               firstName:
 *                 type: string
 *                 example: Ada
 *               lastName:
 *                 type: string
 *                 example: Okafor
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: Password123!
 *               metadata:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       201:
 *         description: Claim submitted successfully
 *       400:
 *         description: Invalid payload or unsupported claim target
 *       403:
 *         description: Claim email domain does not match organization domain
 *       404:
 *         description: Organization not found
 *       409:
 *         description: Organization already claimed or duplicate pending claim
 */

router.post(
  '/organizations/:id/claim',
  validate(organizationClaimSchema),
  submitOrganizationClaim
);

/**
 * @openapi
 * /api/users/organizations/{id}/request-admin-access:
 *   post:
 *     summary: Request admin access for a verified organization
 *     description: |
 *       Submit a leadership-transfer/admin-access request when an organization
 *       already has verified leadership.
 *
 *       **Guardrails:**
 *       - Organization must already be leadership-verified.
 *       - Request email domain must match organization domain when domain is configured.
 *       - Duplicate pending admin-access requests from the same user are rejected.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - firstName
 *               - lastName
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *               reason:
 *                 type: string
 *               metadata:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       201:
 *         description: Admin access request submitted successfully
 *       403:
 *         description: Domain mismatch
 *       404:
 *         description: Organization not found
 *       409:
 *         description: Organization not verified yet or duplicate request
 */
router.post(
  '/organizations/:id/request-admin-access',
  validate(organizationAdminAccessSchema),
  requestOrganizationAdminAccess
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
 *       Currently supports updating firstName, lastName, level, department, and hall.
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
 *               level:
 *                 type: integer
 *                 description: User's level (1-7)
 *                 example: 3
 *               department:
 *                 type: string
 *                 description: Academic department
 *                 example: Computer Science
 *               hall:
 *                 type: string
 *                 description: Residential hall
 *                 example: Eni-Njoku Hall
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
 * /api/users/me/notification-preferences:
 *   get:
 *     summary: Get my notification preferences
 *     description: Retrieve the authenticated user's notification preferences (defaults created if missing).
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification preferences
 *   patch:
 *     summary: Update my notification preferences
 *     description: Partially update the authenticated user's notification preferences.
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
 *               waveStatusUpdated:
 *                 type: boolean
 *               officialResponse:
 *                 type: boolean
 *               announcement:
 *                 type: boolean
 *               commentSurge:
 *                 type: boolean
 *               pingCreated:
 *                 type: boolean
 *               commentReply:
 *                 type: boolean
 *               commentAnonymously:
 *                 type: boolean
 *                 description: Default to posting comments anonymously
 *               pingAnonymously:
 *                 type: boolean
 *                 description: Default to posting pings anonymously
 *     responses:
 *       200:
 *         description: Updated notification preferences
 */
router.get('/me/notification-preferences', authMiddleware, validate(getNotificationPreferencesSchema), getMyNotificationPreferences);
router.patch('/me/notification-preferences', authMiddleware, validate(patchNotificationPreferencesSchema), patchMyNotificationPreferences);

/**
 * @openapi
 * /api/users/me/preferences:
 *   get:
 *     summary: Get my posting behaviour preferences
 *     description: |
 *       Retrieve the authenticated user's posting preferences.
 *       Defaults are created on first access.
 *
 *       **Fields:**
 *       - `commentAnonymously` — whether comments are anonymous by default
 *       - `pingAnonymously` — whether pings are posted anonymously by default
 *       - `anonymousAlias` — alias name shown on anonymous content
 *       - `anonymousAliasProfilePicture` — alias profile picture shown on anonymous content
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User preferences returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 userId:
 *                   type: integer
 *                 commentAnonymously:
 *                   type: boolean
 *                   default: false
 *                 pingAnonymously:
 *                   type: boolean
 *                   default: false
 *   patch:
 *     summary: Update my posting behaviour preferences
 *     description: Partially update posting preferences. Send only the fields you want to change.
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
 *               commentAnonymously:
 *                 type: boolean
 *                 description: Post comments anonymously by default
 *               pingAnonymously:
 *                 type: boolean
 *                 description: Post pings anonymously by default
 *               anonymousAlias:
 *                 type: string
 *                 nullable: true
 *                 description: Alias name shown on anonymous posts/comments
 *               anonymousAliasProfilePicture:
 *                 type: string
 *                 nullable: true
 *                 description: Alias profile picture URL shown on anonymous posts/comments
 *     responses:
 *       200:
 *         description: Updated preferences returned
 *       400:
 *         description: No valid fields provided
 */
router.get('/me/preferences', authMiddleware, validate(getUserPreferencesSchema), getMyPreferences);
router.patch('/me/preferences', authMiddleware, validate(patchUserPreferencesSchema), patchMyPreferences);

/**
 * @openapi
 * /api/users/me/password:
 *   patch:
 *     summary: Change current user password
 *     description: |
 *       Update the authenticated user's password.
 *       Requires the current password for verification.
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
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Incorrect password or invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.patch('/me/password', authMiddleware, validate(changePasswordSchema), changePassword);

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

/**
 * @openapi
 * /api/users/me/analytics:
 *   get:
 *     summary: Get My Analytics
 *     description: Returns total and daily buckets of surges, comments, and waves grouped by week (current or previous).
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         required: false
 *         schema:
 *           type: string
 *           enum: [current, previous]
 *           default: current
 *         description: The week period to fetch analytics for.
 *     responses:
 *       200:
 *         description: User analytics successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totals:
 *                   type: object
 *                   properties:
 *                     surges:
 *                       type: integer
 *                     comments:
 *                       type: integer
 *                     waves:
 *                       type: integer
 *                 daily:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date: 
 *                         type: string
 *                         example: "2026-03-02"
 *                       day: 
 *                         type: string
 *                         example: "Sun"
 *                       surges:
 *                         type: integer
 *                       comments:
 *                         type: integer
 *                       waves:
 *                         type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/me/analytics', authMiddleware, validate(userAnalyticsSchema), getMyAnalytics);

/**
 * @openapi
 * /api/users/{id}/profile:
 *   get:
 *     summary: Get a user's public community profile
 *     description: |
 *       Returns a community-facing profile card for any authenticated member to view.
 *       
 *       **Includes:**
 *       - Display name (or full name if no display name set)
 *       - Role (for frontend badge rendering: `USER`, `REPRESENTATIVE`, `ADMIN`, `SUPER_ADMIN`)
 *       - Previous display names with timestamps (full transparency/accountability log)
 *       - 10 most recent non-anonymous Pings raised by the user
 *       - 10 most recent Waves (solutions) contributed by the user
 *       
 *       **Note:** Only returns data scoped to the requesting user's organization.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the user whose profile to view
 *     responses:
 *       200:
 *         description: Public profile returned
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id/profile', authMiddleware, validate(userIdParamSchema), getUserPublicProfile);

export default router;