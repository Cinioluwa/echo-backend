// src/schemas/adminSchemas.ts
import { z } from 'zod';

export const updateUserRoleSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'User ID must be a number'),
  }),
  body: z.object({
    role: z.enum(['USER', 'ADMIN', 'REPRESENTATIVE']),
  }),
});

export const responseTimeAnalyticsSchema = z.object({
  query: z.object({
    days: z.string().regex(/^\d+$/, 'days must be a positive number').optional(),
  }),
});
