// src/schemas/publicSchemas.ts
import { z } from 'zod';

export const inviteLeaderSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Organization ID must be a number'),
  }),
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

export const shareMetadataSchema = z.object({
  params: z.object({
    entity: z.enum(['feed', 'ping', 'wave', 'comment']),
    id: z.string().regex(/^\d+$/, 'Share content ID must be a number'),
  }),
});

export const shareMetadataAliasIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Share content ID must be a number'),
  }),
});
