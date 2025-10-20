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
  }),
});

export const getCommentsForPingSchema = z.object({
  params: z.object({
    pingId: z.string().regex(/^\d+$/, 'Ping ID must be a number'),
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
  }),
});

export const getCommentsForWaveSchema = z.object({
  params: z.object({
    waveId: z.string().regex(/^\d+$/, 'Wave ID must be a number'),
  }),
});
