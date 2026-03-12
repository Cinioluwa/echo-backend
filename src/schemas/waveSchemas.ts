// src/schemas/waveSchemas.ts
import { z } from 'zod';

// Params schema when pingId is provided in parent route
export const pingParamSchema = z.object({
  params: z.object({
    pingId: z.string().regex(/^\d+$/, 'Ping ID must be a number'),
  }),
});

// Body + Params schema for creating a wave under a ping
export const createWaveSchema = z.object({
  params: z.object({
    pingId: z.string().regex(/^\d+$/, 'Ping ID must be a number'),
  }),
  body: z.object({
    solution: z
      .string({
        message: 'Solution is required',
      })
      .min(3, 'Solution must be at least 3 characters')
      .max(10000, 'Solution is too long'),
    mediaIds: z.array(z.coerce.number().int().positive()).max(5, 'Maximum 5 media files allowed').optional(),
  }).strict(),
});

// Params schema for standalone wave id
export const waveIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Wave ID must be a number'),
  }),
});

// Params schema when waveId is provided in the route (e.g., /api/waves/:waveId/...)
export const waveParamSchema = z.object({
  params: z.object({
    waveId: z.string().regex(/^\d+$/, 'Wave ID must be a number'),
  }),
});

// Body schema for updating a wave
export const updateWaveSchema = z.object({
  body: z.object({
    solution: z
      .string()
      .min(3, 'Solution must be at least 3 characters')
      .max(10000, 'Solution is too long')
      .optional(),
  }).strict(),
});

export const updateWaveStatusSchema = z.object({
  body: z.object({
    status: z.enum(['POSTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD']),
    reason: z.string().optional(),
  }),
}).superRefine((data, ctx) => {
  if (data.body.status === 'REJECTED' && !data.body.reason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Reason is required when rejecting a wave',
      path: ['body', 'reason'],
    });
  }
});
