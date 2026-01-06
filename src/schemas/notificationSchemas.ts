import { z } from 'zod';

export const listNotificationsSchema = z.object({
  query: z
    .object({
      page: z.string().regex(/^\d+$/, 'Page must be a positive number').optional(),
      limit: z.string().regex(/^\d+$/, 'Limit must be a positive number').optional(),
      unreadOnly: z.enum(['true', 'false']).optional(),
    })
    .strict(),
});

export const notificationIdParamSchema = z.object({
  params: z
    .object({
      id: z.string().regex(/^\d+$/, 'Notification ID must be a number'),
    })
    .strict(),
});
