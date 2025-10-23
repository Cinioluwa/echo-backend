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
