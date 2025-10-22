// src/schemas/paginationSchema.ts
import { z } from 'zod';

export const paginationSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/, 'Page must be a positive number').optional(),
    limit: z.string().regex(/^\d+$/, 'Limit must be a positive number').optional(),
  }),
});

export const paginationWithFiltersSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/, 'Page must be a positive number').optional(),
    limit: z.string().regex(/^\d+$/, 'Limit must be a positive number').optional(),
    category: z.enum([
      'GENERAL',
      'ACADEMICS',
      'CHAPEL',
      'COLLEGE',
      'FINANCE',
      'HALL',
      'SPORT',
      'WELFARE',
    ]).optional(),
    status: z.enum(['POSTED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']).optional(),
  }),
});

export const searchSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/, 'Page must be a positive number').optional(),
    limit: z.string().regex(/^\d+$/, 'Limit must be a positive number').optional(),
    hashtag: z.string().max(50).optional(),
    q: z.string().max(200).optional(),
  }).refine(
    (data) => data.hashtag || data.q,
    {
      message: 'Either hashtag or q (query) parameter is required',
    }
  ),
});
