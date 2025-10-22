// src/controllers/surgeController.ts
import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import logger from '../config/logger.js';
import { AuthRequest } from '../types/AuthRequest.js';
// @desc    Toggle surge on a ping
// @route   POST /api/pings/:pingId/surge
// @access  Private
export const toggleSurgeOnPing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { pingId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const pingIdInt = parseInt(pingId);

  try {
    // Verify the ping exists
    const ping = await prisma.ping.findUnique({
      where: { id: pingIdInt },
    });

    if (!ping) {
      return res.status(404).json({ error: 'Ping not found' });
    }

    // Check if the user has already surged this ping
    const existingSurge = await prisma.surge.findFirst({
      where: {
        userId,
        pingId: pingIdInt,
      },
    });

    if (existingSurge) {
      // If surge exists, delete it and decrement the count (un-surge)
      await prisma.$transaction([
        prisma.surge.delete({
          where: {
            id: existingSurge.id,
          },
        }),
        prisma.ping.update({
          where: { id: pingIdInt },
          data: { surgeCount: { decrement: 1 } },
        }),
      ]);
      return res.status(200).json({ message: 'Surge removed from ping', surged: false });
    } else {
      // If surge doesn't exist, create it and increment the count
      await prisma.$transaction([
        prisma.surge.create({
          data: {
            userId,
            pingId: pingIdInt,
          },
        }),
        prisma.ping.update({
          where: { id: pingIdInt },
          data: { surgeCount: { increment: 1 } },
        }),
      ]);
      return res.status(201).json({ message: 'Ping surged', surged: true });
    }
  } catch (error) {
    logger.error('Error toggling surge on ping', { error, pingId: req.params.pingId, userId: req.user?.userId });
    return next(error);
  }
};

// @desc    Toggle surge on a wave
// @route   POST /api/waves/:waveId/surge
// @access  Private
export const toggleSurgeOnWave = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { waveId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const waveIdInt = parseInt(waveId);

  try {
    // Verify the wave exists
    const wave = await prisma.wave.findUnique({
      where: { id: waveIdInt },
    });

    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // Check if the user has already surged this wave
    const existingSurge = await prisma.surge.findFirst({
      where: {
        userId,
        waveId: waveIdInt,
      },
    });

    if (existingSurge) {
      // If surge exists, delete it and decrement the count (un-surge)
      await prisma.$transaction([
        prisma.surge.delete({
          where: {
            id: existingSurge.id,
          },
        }),
        prisma.wave.update({
          where: { id: waveIdInt },
          data: { surgeCount: { decrement: 1 } },
        }),
      ]);
      return res.status(200).json({ message: 'Surge removed from wave', surged: false });
    } else {
      // If surge doesn't exist, create it and increment the count
      await prisma.$transaction([
        prisma.surge.create({
          data: {
            userId,
            waveId: waveIdInt,
          },
        }),
        prisma.wave.update({
          where: { id: waveIdInt },
          data: { surgeCount: { increment: 1 } },
        }),
      ]);
      return res.status(201).json({ message: 'Wave surged', surged: true });
    }
  } catch (error) {
    logger.error('Error toggling surge on wave', { error, waveId: req.params.waveId, userId: req.user?.userId });
    return next(error);
  }
};