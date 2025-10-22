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
    level: z.number({
      message: 'Level is required',
    }).int('Level must be an integer').min(1, 'Level must be between 1 and 7').max(7, 'Level must be between 1 and 7').optional(),
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
