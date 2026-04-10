import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';

const DEFAULT_PREFERENCES = {
  commentAnonymously: false,
  pingAnonymously: false,
  anonymousAlias: null,
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

    const userOptions = await prisma.userPreference.findUnique({
      where: { userId },
    });

    // Enforce 30-day cooldown + 15-min grace period for anonymousAlias
    if (patch.anonymousAlias !== undefined && userOptions) {
      if (userOptions.anonymousAlias !== patch.anonymousAlias) {
        // We track when the anonymous alias was last updated
        const lastChanged = (userOptions as any).anonymousAliasUpdatedAt ?? userOptions.createdAt;
        const now = new Date();
        const msElapsed = now.getTime() - new Date(lastChanged).getTime();
        const GRACE_PERIOD_MS = 15 * 60 * 1000;       // 15 minutes
        const COOLDOWN_MS     = 30 * 24 * 60 * 60 * 1000; // 30 days

        const isWithinCooldown = msElapsed > GRACE_PERIOD_MS && msElapsed < COOLDOWN_MS;

        // Block if trying to change within cooldown, UNLESS this is the first time setting it
        if (isWithinCooldown && userOptions.anonymousAlias !== null && patch.anonymousAlias !== null) {
          const cooldownEndsAt = new Date(new Date(lastChanged).getTime() + COOLDOWN_MS);
          return res.status(429).json({
            error: 'You can only change your alias once every 30 days. The 15-minute correction window has passed.',
            code: 'ALIAS_COOLDOWN',
            cooldownEndsAt: cooldownEndsAt.toISOString(),
          });
        }

        // Apply updated timestamp
        (patch as any).anonymousAliasUpdatedAt = now;
      }
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
