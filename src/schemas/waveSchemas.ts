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
    isAnonymous: z.boolean().optional().default(false),
  }),
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
    isAnonymous: z.boolean().optional(),
  }),
});

export const updateWaveStatusSchema = z.object({
  body: z.object({
    status: z.enum(['POSTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']),
  }),
});
