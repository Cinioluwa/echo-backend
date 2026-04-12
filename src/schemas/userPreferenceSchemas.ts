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
    anonymousAlias: z.string().min(2, 'Alias must be at least 2 characters').max(30, 'Alias must be 30 characters or fewer').nullable().optional(),
    anonymousAliasProfilePicture: z.string().max(2048, 'Alias profile picture URL is too long').nullable().optional(),
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
