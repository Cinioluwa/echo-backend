import { z } from 'zod';

const reportStatusEnum = z.enum(['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED']);

export const createReportSchema = z.object({
  body: z.object({
    pingId: z.coerce.number().int().positive().optional(),
    waveId: z.coerce.number().int().positive().optional(),
    commentId: z.coerce.number().int().positive().optional(),
    reason: z.string().max(1000, 'Reason cannot exceed 1000 characters').optional(),
  }).strict(),
}).superRefine((data, ctx) => {
  const providedTargets = [data.body.pingId, data.body.waveId, data.body.commentId].filter((value) => value !== undefined);
  if (providedTargets.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['body'],
      message: 'Exactly one target is required: pingId, waveId, or commentId.',
    });
  }
});

export const listReportsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: reportStatusEnum.optional(),
  }).strict(),
});

export const updateReportStatusSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Report ID must be a number'),
  }).strict(),
  body: z.object({
    status: reportStatusEnum,
  }).strict(),
});
