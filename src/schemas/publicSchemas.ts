import { z } from 'zod';

export const getPublicPingsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/, 'Page must be a positive number').optional(),
    limit: z.string().regex(/^\d+$/, 'Limit must be a positive number').optional(),
    top: z.string().regex(/^\d+$/, 'Top must be a positive number').optional(),
    sort: z.enum(['trending', 'new']).optional(),
    days: z.union([z.literal('all'), z.string().regex(/^\d+$/, 'Days must be a number')]).optional(),
    organizationId: z.string().regex(/^\d+$/, 'Organization ID must be a number'),
  }),
});

export const getPublicWavesSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/, 'Page must be a positive number').optional(),
    limit: z.string().regex(/^\d+$/, 'Limit must be a positive number').optional(),
    top: z.string().regex(/^\d+$/, 'Top must be a positive number').optional(),
    sort: z.enum(['trending', 'new']).optional(),
    days: z.union([z.literal('all'), z.string().regex(/^\d+$/, 'Days must be a number')]).optional(),
    organizationId: z.string().regex(/^\d+$/, 'Organization ID must be a number'),
  }),
});