import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';

const DEFAULT_PREFERENCES = {
  commentAnonymously: false,
  pingAnonymously: false,
} as const;

/**
 * GET /api/users/me/preferences
 * Returns the authenticated user's posting behaviour preferences.
 * Creates a default record if one doesn't exist yet (upsert pattern).
 */
export const getMyPreferences = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const organizationId = req.organizationId!;

    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const preferences = await prisma.userPreference.upsert({
      where: { userId },
      update: {},
      create: { userId, ...DEFAULT_PREFERENCES },
    });

    return res.status(200).json(preferences);
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/users/me/preferences
 * Partially updates the authenticated user's posting behaviour preferences.
 */
export const patchMyPreferences = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const organizationId = req.organizationId!;
    const patch = req.body as Partial<typeof DEFAULT_PREFERENCES>;

    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const preferences = await prisma.userPreference.upsert({
      where: { userId },
      update: patch,
      create: {
        userId,
        ...DEFAULT_PREFERENCES,
        ...patch,
      },
    });

    return res.status(200).json(preferences);
  } catch (error) {
    return next(error);
  }
};
