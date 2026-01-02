// src/schemas/officialResponseSchemas.ts
import { z } from 'zod';

export const createOfficialResponseSchema = z.object({
  params: z.object({
    pingId: z.string().regex(/^\d+$/, 'Ping ID must be a number'),
  }),
  body: z.object({
    content: z.string({
      message: 'Content is required',
    }).min(1, 'Content cannot be empty').max(5000, 'Content must not exceed 5000 characters'),
    isResolved: z.boolean().optional(),
  }),
});

export const updateOfficialResponseSchema = z.object({
  params: z.object({
    pingId: z.string().regex(/^\d+$/, 'Ping ID must be a number'),
  }),
  body: z.object({
    content: z.string().min(1, 'Content cannot be empty').max(5000, 'Content must not exceed 5000 characters').optional(),
    isResolved: z.boolean().optional(),
  }),
});
