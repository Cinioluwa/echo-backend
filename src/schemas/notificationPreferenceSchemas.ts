import { z } from 'zod';

export const getNotificationPreferencesSchema = z
  .object({
    query: z.record(z.string(), z.unknown()).optional(),
    params: z.record(z.string(), z.unknown()).optional(),
    body: z.unknown().optional(),
  });

const patchBodySchema = z
  .object({
    waveStatusUpdated: z.boolean().optional(),
    officialResponse: z.boolean().optional(),
    announcement: z.boolean().optional(),
    commentSurge: z.boolean().optional(),
    pingCreated: z.boolean().optional(),
    commentReply: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one preference field must be provided',
  });

export const patchNotificationPreferencesSchema = z
  .object({
    body: patchBodySchema,
    query: z.record(z.string(), z.unknown()).optional(),
    params: z.record(z.string(), z.unknown()).optional(),
  });

