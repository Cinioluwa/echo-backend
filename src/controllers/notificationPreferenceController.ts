import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';

const DEFAULT_PREFERENCES = {
  waveStatusUpdated: true,
  officialResponse: true,
  announcement: true,
  commentSurge: true,
  pingCreated: true,
  commentReply: true,
} as const;

export const getMyNotificationPreferences = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.organizationId!;
    const userId = req.user!.userId;

    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const preferences = await prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: { userId, ...DEFAULT_PREFERENCES },
    });

    return res.status(200).json(preferences);
  } catch (error) {
    return next(error);
  }
};

export const patchMyNotificationPreferences = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.organizationId!;
    const userId = req.user!.userId;
    const patch = req.body as Partial<typeof DEFAULT_PREFERENCES>;

    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const preferences = await prisma.notificationPreference.upsert({
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

