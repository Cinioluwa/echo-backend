import { z } from 'zod';

export const getUserPreferencesSchema = z.object({
  query: z.record(z.string(), z.unknown()).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  body: z.unknown().optional(),
});

const patchBodySchema = z
  .object({
    commentAnonymously: z.boolean().optional(),
    pingAnonymously: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one preference field must be provided',
  });

export const patchUserPreferencesSchema = z.object({
  body: patchBodySchema,
  query: z.record(z.string(), z.unknown()).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});
