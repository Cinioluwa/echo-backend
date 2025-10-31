// src/schemas/pingSchemas.ts
import { z } from 'zod';

export const createPingSchema = z.object({
  body: z.object({
    title: z.string({
      message: 'Title is required',
    }).min(1, 'Title cannot be empty').max(200),
    content: z.string({
      message: 'Content is required',
    }).min(1, 'Content cannot be empty').max(5000),
    categoryId: z.number().int().positive({
      message: 'Valid category ID is required',
    }),
    hashtag: z.string().max(50).optional().nullable(),
  }),
});

export const updatePingSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title cannot be empty').max(200).optional(),
    content: z.string().min(1, 'Content cannot be empty').max(5000).optional(),
    categoryId: z.number().int().positive().optional(),
    hashtag: z.string().max(50).optional().nullable(),
    status: z.enum(['POSTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']).optional(),
  }).strict(), // Prevents adding extra fields
});

export const pingIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Ping ID must be a number'),
  }),
});
