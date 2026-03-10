// src/schemas/superAdminSchemas.ts
import { z } from 'zod';

export const listSuperAdminOrgsSchema = z.object({
  query: z.object({
    status: z.enum(['PENDING', 'ACTIVE']).optional(),
    page: z.string().regex(/^\d+$/, 'Page must be a positive number').optional(),
    limit: z.string().regex(/^\d+$/, 'Limit must be a positive number').optional(),
  }),
});

export const orgIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Organization ID must be a number'),
  }),
});

export const updateOrgStatusSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Organization ID must be a number'),
  }),
  body: z.object({
    status: z.enum(['ACTIVE', 'PENDING']),
  }),
});

export const listSuperAdminUsersSchema = z.object({
  query: z.object({
    orgId: z.string().regex(/^\d+$/, 'Org ID must be a number').optional(),
    role: z.enum(['USER', 'REPRESENTATIVE', 'ADMIN', 'SUPER_ADMIN']).optional(),
    status: z.enum(['ACTIVE', 'PENDING']).optional(),
    search: z.string().max(200).optional(),
    page: z.string().regex(/^\d+$/, 'Page must be a positive number').optional(),
    limit: z.string().regex(/^\d+$/, 'Limit must be a positive number').optional(),
  }),
});

export const superAdminUserIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'User ID must be a number'),
  }),
});

export const updateUserStatusSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'User ID must be a number'),
  }),
  body: z.object({
    status: z.enum(['ACTIVE', 'PENDING']),
  }),
});

export const cleanupStaleRequestsSchema = z.object({
  body: z.object({
    dryRun: z.boolean().optional().default(false),
    olderThanDays: z.number().int().min(1).max(365).optional().default(30),
  }),
});

export const updateOrgDetailsSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Organization ID must be a number'),
  }),
  body: z
    .object({
      name: z.string().min(1).max(200).optional(),
      domain: z.string().max(200).nullable().optional(),
      joinPolicy: z.enum(['OPEN', 'REQUIRES_APPROVAL']).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'At least one field must be provided' }),
});

export const updateUserRoleAsSuperAdminSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'User ID must be a number'),
  }),
  body: z.object({
    role: z.enum(['USER', 'REPRESENTATIVE', 'ADMIN', 'SUPER_ADMIN']),
  }),
});

export const purgeExpiredTokensSchema = z.object({
  body: z.object({
    dryRun: z.boolean().optional().default(false),
  }),
});
