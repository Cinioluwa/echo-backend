// src/schemas/userSchemas.ts
import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z.string({
      message: 'Email is required',
    }).email('Invalid email address'),
    password: z.string({
      message: 'Password is required',
    }).min(8, 'Password must be at least 8 characters long'),
    firstName: z.string({
      message: 'First name is required',
    }).min(1, 'First name cannot be empty').max(50),
    lastName: z.string({
      message: 'Last name is required',
    }).min(1, 'Last name cannot be empty').max(50),
    level: z.number().int('Level must be an integer').min(1, 'Level must be between 1 and 7').max(7, 'Level must be between 1 and 7').optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string({
      message: 'Email is required',
    }).email('Invalid email address'),
    password: z.string({
      message: 'Password is required',
    }).min(1, 'Password cannot be empty'),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name cannot be empty').max(50).optional(),
    lastName: z.string().min(1, 'Last name cannot be empty').max(50).optional(),
    level: z.number().int('Level must be an integer').min(1, 'Level must be between 1 and 7').max(7, 'Level must be between 1 and 7').optional(),
  }).strict(), // Prevents adding extra fields like password, email, etc.
});

export const userIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'User ID must be a number'),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(10, 'Token is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(10, 'Token is required'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
  }),
});

export const googleAuthSchema = z.object({
  body: z.object({
    idToken: z.string().min(10, 'Google ID token is required'),
  }),
});

export const organizationWaitlistSchema = z.object({
  body: z.object({
    organizationName: z.string().min(2, 'Organization name is required').max(120),
    email: z.string().email('Invalid email address'),
    firstName: z.string().min(1, 'First name is required').max(50),
    lastName: z.string().min(1, 'Last name is required').max(50),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
});
