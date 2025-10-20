// src/routes/userRoutes.ts
import { Router } from 'express';
import { 
  registerUser, 
  loginUser, 
  deleteCurrentUser, 
  updateCurrentUser, 
  getCurrentUser,
  getMySurges,
  getMyComments
} from '../controllers/userController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { registerSchema, loginSchema, updateUserSchema } from '../schemas/userSchemas.js';

const router = Router();

// Register a new user - with validation
router.post('/register', validate(registerSchema), registerUser);

// Login a user - with validation
router.post('/login', validate(loginSchema), loginUser);

// Current user routes (get, update, delete profile)
router.route('/me')
  .get(authMiddleware, getCurrentUser)                                   // Get current user profile
  .patch(authMiddleware, validate(updateUserSchema), updateCurrentUser)  // Update profile (firstName/lastName) - with validation
  .delete(authMiddleware, deleteCurrentUser);                            // Delete account

// User activity routes (must come after /me to avoid route conflicts)
router.get('/me/surges', authMiddleware, getMySurges);      // Get all my surges (likes)
router.get('/me/comments', authMiddleware, getMyComments);  // Get all my comments

export default router;