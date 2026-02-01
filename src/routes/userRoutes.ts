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

// Register a new user - with validation
router.post('/register', validate(registerSchema), registerUser);

// Login a user - with validation
router.post('/login', validate(loginSchema), loginUser);

// Google OAuth login
router.post('/google', validate(googleAuthSchema), loginWithGoogle);

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
        ? `${env.APP_URL}/login`
        : `${env.APP_URL}/login`;  // Could redirect to an error page if needed
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

// Password reset flow
router.post('/forgot-password', validate(forgotPasswordSchema), requestPasswordReset);
router.patch('/reset-password', validate(resetPasswordSchema), resetPassword);

// New organization onboarding request
router.post(
  '/organization-waitlist',
  validate(organizationWaitlistSchema),
  requestOrganizationOnboarding
);

// Current user routes (get, update, delete profile)
router.route('/me')
  .get(authMiddleware, getCurrentUser)                                   // Get current user profile
  .patch(authMiddleware, validate(updateUserSchema), updateCurrentUser)  // Update profile (firstName/lastName) - with validation
  .delete(authMiddleware, deleteCurrentUser);                            // Delete account

// User activity routes (must come after /me to avoid route conflicts)
router.get('/me/surges', authMiddleware, getMySurges);      // Get all my surges (likes)
router.get('/me/comments', authMiddleware, getMyComments);  // Get all my comments

export default router;