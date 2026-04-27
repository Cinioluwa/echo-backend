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

export const responseTimeAnalyticsSchema = z.object({
  query: z.object({
    days: z.string().regex(/^\d+$/, 'days must be a positive number').optional(),
  }),
});

export const analyticsWindowSchema = z.object({
  query: z.object({
    weeks: z.coerce.number().int().min(1).max(52).default(1),
    offsetWeeks: z.coerce.number().int().min(0).max(520).default(0),
  }),
});

export const analyticsWindowOptionalSchema = z.object({
  query: z.object({
    weeks: z.coerce.number().int().min(1).max(52).optional(),
    offsetWeeks: z.coerce.number().int().min(0).max(520).optional(),
  }),
});

export const priorityPingsSchema = z.object({
  query: z.object({
    weeks: z.coerce.number().int().min(1).max(52).default(1),
    offsetWeeks: z.coerce.number().int().min(0).max(520).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const updateOrganizationJoinPolicySchema = z.object({
  body: z.object({
    joinPolicy: z.enum(['OPEN', 'REQUIRES_APPROVAL']),
  }),
});

export const organizationJoinRequestIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Join request ID must be a number'),
  }),
});

export const listOrganizationJoinRequestsSchema = z.object({
  query: z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  }),
});

export const rejectOrganizationJoinRequestSchema = z.object({
  body: z.object({
    reason: z.string().max(500).optional(),
  }),
});

export const listOrganizationClaimsSchema = z.object({
  query: z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  }),
});

export const organizationClaimIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Claim ID must be a number'),
  }),
});

export const rejectOrganizationClaimSchema = z.object({
  body: z.object({
    reason: z.string().max(500).optional(),
  }),
});

export const adminOverviewDashboardSchema = z.object({
  query: z.object({
    months: z.coerce.number().int().min(1).max(24).default(7),
    unresolvedDays: z.coerce.number().int().min(1).max(365).default(7),
    topPingsLimit: z.coerce.number().int().min(1).max(20).default(3),
    oldestLimit: z.coerce.number().int().min(1).max(20).default(3),
  }),
});

export const surgingIssuesSchema = z.object({
  query: z.object({
    hours: z.coerce.number().int().min(1).max(72).default(6),
    offsetHours: z.coerce.number().int().min(0).max(720).default(0),
    minEvents: z.coerce.number().int().min(1).max(100).default(3),
    limit: z.coerce.number().int().min(1).max(20).default(5),
  }),
});

export const topContributorsSchema = z.object({
  query: z.object({
    days: z.coerce.number().int().min(1).max(365).default(30),
    limit: z.coerce.number().int().min(1).max(50).default(3),
  }),
});

export const communityMoodSchema = z.object({
  query: z.object({
    days: z.coerce.number().int().min(1).max(365).default(30),
  }),
});

export const pingsByLocationSchema = z.object({
  query: z.object({
    groupBy: z.enum(['hall', 'department']).default('hall'),
    weeks: z.coerce.number().int().min(1).max(52).optional(),
    offsetWeeks: z.coerce.number().int().min(0).max(520).optional(),
  }),
});

export const stallingPingsSchema = z.object({
  query: z.object({
    staleDays: z.coerce.number().int().min(1).max(365).default(14),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }),
});

export const activityTimeSeriesSchema = z.object({
  query: z.object({
    days: z.coerce.number().int().min(1).max(90).default(7),
  }),
});
