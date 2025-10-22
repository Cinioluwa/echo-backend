// src/schemas/announcementSchemas.ts
import { z } from 'zod';

export const createAnnouncementSchema = z.object({
  body: z.object({
    title: z.string({
      message: 'Title is required',
    }).min(1, 'Title cannot be empty').max(200, 'Title cannot exceed 200 characters'),
    content: z.string({
      message: 'Content is required',
    }).min(1, 'Content cannot be empty'),
    targetCollege: z.array(z.string()).optional().default([]),
    targetHall: z.array(z.string()).optional().default([]),
    targetLevel: z.array(z.number().int().min(1).max(7)).optional().default([]),
    targetGender: z.array(z.enum(['MALE', 'FEMALE', 'OTHER'])).optional().default([]),
  }),
});

export const updateAnnouncementSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title cannot be empty').max(200, 'Title cannot exceed 200 characters').optional(),
    content: z.string().min(1, 'Content cannot be empty').optional(),
    targetCollege: z.array(z.string()).optional(),
    targetHall: z.array(z.string()).optional(),
    targetLevel: z.array(z.number().int().min(1).max(7)).optional(),
    targetGender: z.array(z.enum(['MALE', 'FEMALE', 'OTHER'])).optional(),
  }).strict(),
});

export const getAnnouncementsSchema = z.object({
  query: z.object({
    college: z.string().optional(),
    hall: z.string().optional(),
    level: z.string().regex(/^\d+$/, 'Level must be a number').optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  }),
});
