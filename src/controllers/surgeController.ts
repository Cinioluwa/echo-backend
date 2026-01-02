// src/controllers/surgeController.ts
import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
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
    // Verify the ping exists and belongs to the user's organization
    const ping = await prisma.ping.findFirst({
      where: { 
        id: pingIdInt,
        organizationId: req.organizationId!,
      },
    });

    if (!ping) {
      return res.status(404).json({ error: 'Ping not found' });
    }

    // Check if the user has already surged this ping
    const existingSurge = await prisma.surge.findFirst({
      where: { 
        userId, 
        pingId: pingIdInt,
        organizationId: req.organizationId!,
      },
      select: { id: true },
    });

    if (existingSurge) {
      // If surge exists, delete it
      await prisma.surge.delete({ where: { id: existingSurge.id } });
      // Re-sync the denormalized count to avoid drift
      const count = await prisma.surge.count({ 
        where: { 
          pingId: pingIdInt,
          organizationId: req.organizationId!,
        } 
      });
      await prisma.ping.update({ where: { id: pingIdInt }, data: { surgeCount: count } });
      return res.status(200).json({ message: 'Surge removed from ping', surged: false, surgeCount: count });
    }

    // If surge doesn't exist, try to create it
    try {
      await prisma.surge.create({ 
        data: { 
          userId, 
          pingId: pingIdInt,
          organizationId: req.organizationId!,
        } 
      });
    } catch (err: any) {
      // Handle unique constraint conflicts gracefully (from partial unique index)
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Another request created the surge concurrently; proceed
      } else {
        throw err;
      }
    }
    // Re-sync the denormalized count to avoid drift
    const count = await prisma.surge.count({ 
      where: { 
        pingId: pingIdInt,
        organizationId: req.organizationId!,
      } 
    });
    await prisma.ping.update({ where: { id: pingIdInt }, data: { surgeCount: count } });
    return res.status(200).json({ message: 'Ping surged', surged: true, surgeCount: count });
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
    // Verify the wave exists and belongs to the user's organization
    const wave = await prisma.wave.findFirst({
      where: { 
        id: waveIdInt,
        organizationId: req.organizationId!,
      },
    });

    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // Check if the user has already surged this wave
    const existingSurge = await prisma.surge.findFirst({
      where: { 
        userId, 
        waveId: waveIdInt,
        organizationId: req.organizationId!,
      },
      select: { id: true },
    });

    if (existingSurge) {
      await prisma.surge.delete({ where: { id: existingSurge.id } });
      const count = await prisma.surge.count({ 
        where: { 
          waveId: waveIdInt,
          organizationId: req.organizationId!,
        } 
      });
      await prisma.wave.update({ where: { id: waveIdInt }, data: { surgeCount: count } });
      return res.status(200).json({ message: 'Surge removed from wave', surged: false, surgeCount: count });
    }

    try {
      await prisma.surge.create({ 
        data: { 
          userId, 
          waveId: waveIdInt,
          organizationId: req.organizationId!,
        } 
      });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Another request created the surge concurrently; proceed
      } else {
        throw err;
      }
    }
    const count = await prisma.surge.count({ 
      where: { 
        waveId: waveIdInt,
        organizationId: req.organizationId!,
      } 
    });
    await prisma.wave.update({ where: { id: waveIdInt }, data: { surgeCount: count } });
    return res.status(200).json({ message: 'Wave surged', surged: true, surgeCount: count });
  } catch (error) {
    logger.error('Error toggling surge on wave', { error, waveId: req.params.waveId, userId: req.user?.userId });
    return next(error);
  }
};