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

export const analyticsWindowSchema = z.object({
  query: z.object({
    weeks: z.coerce.number().int().min(1).max(52).default(1),
    offsetWeeks: z.coerce.number().int().min(0).max(520).default(0),
  }),
});

export const analyticsWindowOptionalSchema = z.object({
  query: z.object({
    weeks: z.coerce.number().int().min(1).max(52).optional(),
    offsetWeeks: z.coerce.number().int().min(0).max(520).optional(),
  }),
});

export const priorityPingsSchema = z.object({
  query: z.object({
    weeks: z.coerce.number().int().min(1).max(52).default(1),
    offsetWeeks: z.coerce.number().int().min(0).max(520).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});
