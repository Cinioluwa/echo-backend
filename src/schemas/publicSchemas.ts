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
