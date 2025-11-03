import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import logger from '../config/logger.js';
import { AuthRequest } from '../types/AuthRequest.js';

// @desc    Create a new wave (solution) for a ping
// @route   POST /api/pings/:pingId/waves
// @access  Private
export const createWave = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { pingId } = req.params;
    const { solution } = req.body;
    const organizationId = req.user?.organizationId; // From authMiddleware

    if (!organizationId) {
      return res.status(400).json({ error: 'Bad Request: Organization context missing' });
    }

    if (!solution) {
      return res.status(400).json({ error: 'Solution is required' });
    }

    // Verify the ping exists in the user's org
    const ping = await prisma.ping.findFirst({
      where: { id: parseInt(pingId), organizationId },
    });

    if (!ping) {
      return res.status(404).json({ error: 'Ping not found or access denied' });
    }

    const newWave = await prisma.wave.create({
      data: {
        solution,
        pingId: parseInt(pingId),
        organizationId, // Add organizationId
      },
    });

    return res.status(201).json(newWave);
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

    // --- Pagination Logic ---
    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    if (limit > 100) limit = 100; // Cap the limit to 100
    const skip = (page - 1) * limit;

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
          surgeCount: 'desc', // Most surged solutions first
        },
        include: {
          comments: {
            include: {
              author: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          _count: {
            select: { comments: true, surges: true },
          },
        },
      }),
      prisma.wave.count({ where: whereClause }),
    ]);

    // --- Metadata Calculation ---
    const totalPages = Math.ceil(totalWaves / limit);

    return res.status(200).json({
      data: waves,
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
    const wave = await prisma.wave.findFirst({
      where: { 
        id: waveId,
        organizationId: organizationId,
      },
      include: {
        ping: {
          include: {
            author: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
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
              },
            },
          },
        },
        _count: { select: { comments: true, surges: true } },
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
    return res.status(200).json({ ...wave, viewCount: wave.viewCount + 1 });
  } catch (error) {
    logger.error('Error fetching wave', { error, waveId: req.params.id });
    return next(error);
  }
};