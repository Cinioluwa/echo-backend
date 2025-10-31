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
    categoryIds: z.array(z.number().int().positive()).optional().default([]),
  }),
});

export const updateAnnouncementSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title cannot be empty').max(200, 'Title cannot exceed 200 characters').optional(),
    content: z.string().min(1, 'Content cannot be empty').optional(),
    categoryIds: z.array(z.number().int().positive()).optional(),
  }).strict(),
});

export const getAnnouncementsSchema = z.object({
  query: z.object({
    categoryId: z.string().regex(/^\d+$/, 'Category ID must be a number').optional(),
  }),
});
