// src/schemas/uploadSchema.ts
import { z } from 'zod';

export const attachMediaSchema = z.object({
  body: z.object({
    mediaIds: z
      .array(z.coerce.number().int().positive())
      .min(1, 'At least one media ID is required')
      .max(10, 'Maximum 10 media files can be attached at once'),
    entityType: z.enum(['ping', 'wave'], {
      message: 'entityType must be "ping" or "wave"',
    }),
    entityId: z.coerce.number().int().positive('entityId must be a positive integer'),
  }),
});

export const mediaIdParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('Media ID must be a positive integer'),
  }),
});

export const pingIdParamSchema = z.object({
  params: z.object({
    pingId: z.coerce.number().int().positive('Ping ID must be a positive integer'),
  }),
});

export const waveIdParamSchema = z.object({
  params: z.object({
    waveId: z.coerce.number().int().positive('Wave ID must be a positive integer'),
  }),
});

// For validating mediaIds when creating pings/waves
export const mediaIdsSchema = z
  .array(z.coerce.number().int().positive())
  .max(5, 'Maximum 5 media files allowed per ping/wave')
  .optional();
