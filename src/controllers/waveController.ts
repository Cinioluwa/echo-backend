import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import logger from '../config/logger.js';
import { AuthRequest } from '../types/AuthRequest.js';
import { invalidateCacheAfterMutation } from '../utils/cacheInvalidation.js';
import { emitWaveCreated, emitWaveDeleted } from '../utils/socketEmitter.js';
import { appendWaveBadges } from '../utils/waveBadges.js';
import { createNotification } from '../services/notificationService.js';

// @desc    Create a new wave (solution) for a ping
// @route   POST /api/pings/:pingId/waves
// @access  Private
export const createWave = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { pingId } = req.params;
    const { solution, mediaIds } = req.body;
    const organizationId = req.user?.organizationId; // From authMiddleware
    const userId = req.user?.userId;

    if (!organizationId) {
      return res.status(400).json({ error: 'Bad Request: Organization context missing' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'Bad Request: User context missing' });
    }
    if (!solution) {
      return res.status(400).json({ error: 'Solution is required' });
    }

    // Verify the ping exists in the user's org
    const ping = await prisma.ping.findFirst({
      where: { id: parseInt(pingId), organizationId },
      include: { author: true },
    });

    if (!ping) {
      return res.status(404).json({ error: 'Ping not found or access denied' });
    }

    // Create the wave first (without media include — media isn't linked yet)
    const newWave = await prisma.wave.create({
      data: {
        solution,
        pingId: parseInt(pingId),
        organizationId,
        authorId: userId,
      },
      select: { id: true },
    });

    // Attach media AFTER the wave exists so the waveId FK is valid
    if (mediaIds && Array.isArray(mediaIds) && mediaIds.length > 0) {
      await prisma.media.updateMany({
        where: {
          id: { in: mediaIds },
          organizationId,
          pingId: null, // Only unattached media
          waveId: null,
        },
        data: { waveId: newWave.id },
      });
    }

    // Re-fetch the wave now that media records have been linked
    const waveWithMedia = await prisma.wave.findUnique({
      where: { id: newWave.id },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            level: true,
            department: true,
            hall: true,
            profilePicture: true,
            role: true,
            status: true,
            createdAt: true,
          },
        },
        media: {
          select: { id: true, url: true, filename: true, mimeType: true, width: true, height: true },
        },
      },
    });

    // Invalidate cache after creating wave
    await invalidateCacheAfterMutation(organizationId);

    emitWaveCreated(organizationId, waveWithMedia!);

    if (ping.authorId !== userId) {
      const authorName = waveWithMedia!.author.firstName ? `${waveWithMedia!.author.firstName} ${waveWithMedia!.author.lastName || ''}`.trim() : 'Someone';
      await createNotification(prisma as any, {
        userId: ping.authorId,
        organizationId,
        type: 'NEW_WAVE_ON_PING',
        title: 'New wave proposed',
        body: `${authorName} proposed a new wave for your ping "${ping.title}"`,
        pingId: ping.id,
        waveId: newWave.id,
      });
    }

    return res.status(201).json(waveWithMedia);
  } catch (error) {
    logger.error('Error creating wave', { error, pingId: req.params.pingId, userId: req.user?.userId });
    return next(error);
  }
};

// @desc    Get all waves (solutions) for a specific ping
// @route   GET /api/pings/:pingId/waves
// @access  Private
export const getWavesForPing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { pingId } = req.params;
    const organizationId = req.user?.organizationId; // From authMiddleware

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required.' });
    }

    // Verify the ping exists and belongs to the user's organization
    const ping = await prisma.ping.findFirst({
      where: { id: parseInt(pingId), organizationId },
    });

    if (!ping) {
      return res.status(404).json({ error: 'Ping not found or access denied' });
    }

    // --- Pagination Logic ---
    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    if (limit > 100) limit = 100; // Cap the limit to 100
    const skip = (page - 1) * limit;

    const userId = req.user?.userId;
    const whereClause = {
      pingId: parseInt(pingId),
      organizationId: organizationId,
    };

    // Run two queries in parallel: one for the data, one for the total count
    const [waves, totalWaves] = await prisma.$transaction([
      prisma.wave.findMany({
        where: whereClause,
        skip: skip,
        take: limit,
        orderBy: {
          surgeCount: 'desc',
        },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              level: true,
              department: true,
              hall: true,
              profilePicture: true,
              role: true,
              status: true,
              createdAt: true,
            },
          },
          media: {
            select: { id: true, url: true, filename: true, mimeType: true, width: true, height: true },
          },
          comments: {
            take: 10,
            include: {
              author: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  level: true,
                  department: true,
                  hall: true,
                  profilePicture: true,
                  role: true,
                  status: true,
                  createdAt: true,
                },
              },
            },
          },
          _count: {
            select: { comments: true, surges: true },
          },
          surges: userId ? { where: { userId }, select: { id: true } } : false,
        },
      }),
      prisma.wave.count({ where: whereClause }),
    ]);

    // --- Metadata Calculation ---
    const totalPages = Math.ceil(totalWaves / limit);

    // Sanitize anonymous waves and comments, add hasSurged (always boolean)
    const sanitizedWaves = waves.map(wave => {
      let hasSurged = false;
      if (userId) {
        hasSurged = Array.isArray(wave.surges) ? wave.surges.length > 0 : false;
      }
      return {
        ...wave,
        hasSurged,
        comments: wave.comments.map(comment => ({
          ...comment,
          author: comment.isAnonymous ? null : comment.author,
        })),
      };
    });

    const itemsWithBadges = await appendWaveBadges(sanitizedWaves, organizationId!);

    return res.status(200).json({
      data: itemsWithBadges,
      pagination: {
        totalWaves,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    logger.error('Error fetching waves', { error, pingId: req.params.pingId });
    return next(error);
  }
};

// @desc    Get waves authored by the current user
// @route   GET /api/waves/me
// @access  Private
export const getMyWaves = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const organizationId = req.user?.organizationId;

    if (!userId || !organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    if (limit > 100) limit = 100;
    const skip = (page - 1) * limit;

    const whereClause = {
      organizationId,
      authorId: userId,
    };

    const [waves, totalWaves] = await prisma.$transaction([
      prisma.wave.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          author: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              level: true,
              department: true,
              hall: true,
              profilePicture: true,
              role: true,
              status: true,
              createdAt: true,
            },
          },
          media: {
            select: { id: true, url: true, filename: true, mimeType: true, width: true, height: true },
          },
          ping: {
            select: {
              id: true,
              title: true,
              createdAt: true,
              category: { select: { id: true, name: true } },
              author: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  level: true,
                  department: true,
                  hall: true,
                  profilePicture: true,
                  role: true,
                  status: true,
                  createdAt: true,
                },
              },
            },
          },
          _count: { select: { comments: true, surges: true } },
          surges: { where: { userId }, select: { id: true } },
        },
      }),
      prisma.wave.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(totalWaves / limit);

    const sanitized = waves.map((wave) => ({
      ...wave,
      hasSurged: Array.isArray(wave.surges) ? wave.surges.length > 0 : false,
      surges: undefined,
    }));

    const withBadges = await appendWaveBadges(sanitized, organizationId);

    return res.status(200).json({
      data: withBadges,
      pagination: {
        totalWaves,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    logger.error('Error fetching user waves', { error, userId: req.user?.userId });
    return next(error);
  }
};

// @desc    Get a specific wave by ID
// @route   GET /api/waves/:id
// @access  Private
export const getWaveById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;
    const waveId = parseInt(id);

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required.' });
    }

    // Fetch the wave with related data first
    const userId = req.user?.userId;
    const wave = await prisma.wave.findFirst({
      where: { 
        id: waveId,
        organizationId: organizationId,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            level: true,
            department: true,
            hall: true,
            profilePicture: true,
            role: true,
            status: true,
            createdAt: true,
          },
        },
        media: {
          select: { id: true, url: true, filename: true, mimeType: true, width: true, height: true },
        },
        ping: {
          include: {
            author: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                level: true,
                department: true,
                hall: true,
                profilePicture: true,
                role: true,
                status: true,
                createdAt: true,
              },
            },
            surges: userId ? { where: { userId }, select: { id: true } } : false,
          },
        },
        comments: {
          take: 10,
          include: {
            author: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                level: true,
                department: true,
                hall: true,
                profilePicture: true,
                role: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
        _count: { select: { comments: true, surges: true } },
        surges: userId ? { where: { userId }, select: { id: true } } : false,
      },
    });

    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // Increment view count after confirming existence
    await prisma.wave.update({
      where: { id: waveId },
      data: { viewCount: { increment: 1 } },
      select: { id: true },
    });

    // Return the previously fetched data with an adjusted viewCount to avoid an extra roundtrip
    const sanitizedWave = {
      ...wave,
      viewCount: wave.viewCount + 1,
      hasSurged: userId ? (wave.surges && wave.surges.length > 0) : false,
      ping: wave.ping ? {
        ...wave.ping,
        hasSurged: userId ? (wave.ping.surges && wave.ping.surges.length > 0) : false,
      } : undefined,
    };

    const [waveWithBadges] = await appendWaveBadges([sanitizedWave], organizationId);

    return res.status(200).json(waveWithBadges);
  } catch (error) {
    logger.error('Error fetching wave', { error, waveId: req.params.id });
    return next(error);
  }
};

// @desc    Update a wave
// @route   PATCH /api/waves/:id
// @access  Private
export const updateWave = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const organizationId = req.user?.organizationId;

    if (!req.body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const { solution } = req.body;

    const wave = await prisma.wave.findUnique({
      where: { id: parseInt(id) },
    });

    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // Check organization isolation first
    if (wave.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // Allow the wave's own author or the ping's author to update
    const ping = await prisma.ping.findUnique({
      where: { id: wave.pingId },
      select: { authorId: true },
    });

    const isWaveAuthor = wave.authorId === userId;
    const isPingAuthor = ping?.authorId === userId;

    if (!isWaveAuthor && !isPingAuthor) {
      return res.status(403).json({ error: 'Forbidden: Only the wave author or ping author can update waves' });
    }

    const updateData: any = {};
    if (solution !== undefined) updateData.solution = solution;

    const updatedWave = await prisma.wave.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            level: true,
            department: true,
            hall: true,
            profilePicture: true,
            role: true,
            status: true,
            createdAt: true,
          },
        },
        ping: {
          include: {
            author: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                level: true,
                department: true,
                hall: true,
                profilePicture: true,
                role: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                level: true,
                department: true,
                hall: true,
                profilePicture: true,
                role: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
        _count: { select: { comments: true, surges: true } },
      },
    });

    // Invalidate cache after update
    await invalidateCacheAfterMutation(organizationId);

    return res.status(200).json(updatedWave);
  } catch (error) {
    logger.error('Error updating wave', { error, waveId: req.params.id, userId: req.user?.userId });
    return next(error);
  }
};

// @desc    Delete a wave
// @route   DELETE /api/waves/:id
// @access  Private
export const deleteWave = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const organizationId = req.user?.organizationId;

    const wave = await prisma.wave.findUnique({
      where: { id: parseInt(id) },
    });

    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // Check organization isolation first
    if (wave.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // Allow the wave's own author or the ping's author to delete
    const ping = await prisma.ping.findUnique({
      where: { id: wave.pingId },
      select: { authorId: true },
    });

    const isWaveAuthor = wave.authorId === userId;
    const isPingAuthor = ping?.authorId === userId;

    if (!isWaveAuthor && !isPingAuthor) {
      return res.status(403).json({ error: 'Forbidden: Only the wave author or ping author can delete waves' });
    }

    await prisma.wave.delete({
      where: { id: parseInt(id) },
    });

    // Invalidate cache after deletion
    await invalidateCacheAfterMutation(organizationId);

    emitWaveDeleted(organizationId, parseInt(id));

    return res.status(204).send();
  } catch (error) {
    logger.error('Error deleting wave', { error, waveId: req.params.id, userId: req.user?.userId });
    return next(error);
  }
};