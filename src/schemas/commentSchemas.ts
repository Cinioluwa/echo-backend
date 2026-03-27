// src/schemas/commentSchemas.ts
import { z } from 'zod';

export const createCommentOnPingSchema = z.object({
  params: z.object({
    pingId: z.string().regex(/^\d+$/, 'Ping ID must be a number'),
  }),
  body: z.object({
    content: z
      .string({ message: 'Content is required' })
      .min(2, 'Content must be at least 2 characters')
      .max(5000, 'Content is too long'),
    isAnonymous: z.boolean().optional().default(false),
  }),
});

export const getCommentsForPingSchema = z.object({
  params: z.object({
    pingId: z.string().regex(/^\d+$/, 'Ping ID must be a number'),
  }),
  query: z.object({
    organizationId: z.string().regex(/^\d+$/, 'Organization ID must be a number').optional(),
  }),
});

export const createCommentOnWaveSchema = z.object({
  params: z.object({
    waveId: z.string().regex(/^\d+$/, 'Wave ID must be a number'),
  }),
  body: z.object({
    content: z
      .string({ message: 'Content is required' })
      .min(2, 'Content must be at least 2 characters')
      .max(5000, 'Content is too long'),
    isAnonymous: z.boolean().optional().default(false),
  }),
});

export const getCommentsForWaveSchema = z.object({
  params: z.object({
    waveId: z.string().regex(/^\d+$/, 'Wave ID must be a number'),
  }),
});

export const commentParamSchema = z.object({
  params: z.object({
    commentId: z.string().regex(/^\d+$/, 'Comment ID must be a number'),
  }),
});
export const deleteCommentSchema = z.object({
  params: z.object({
    commentId: z.string().regex(/^\d+$/, 'Comment ID must be a number'),
  }),
});
