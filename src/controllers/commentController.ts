import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import logger from '../config/logger.js';
import { AuthRequest } from '../types/AuthRequest.js';

// @desc    Create a new comment on a ping
// @route   POST /api/pings/:pingId/comments
// @access  Private
export const createCommentOnPing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { pingId } = req.params;
    const { content } = req.body;
    const userId = req.user?.userId;
    const organizationId = req.organizationId!;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Verify the ping exists in the user's org
    const ping = await prisma.ping.findUnique({
      where: { id: parseInt(pingId), organizationId },
    });

    if (!ping) {
      return res.status(404).json({ error: 'Ping not found or access denied' });
    }

    const newComment = await prisma.comment.create({
      data: {
        content,
        authorId: userId,
        pingId: parseInt(pingId),
        organizationId, // Add organizationId
      },
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
    });

    return res.status(201).json(newComment);
  } catch (error) {
    logger.error('Error creating comment on ping', { error, pingId: req.params.pingId, userId: req.user?.userId });
    return next(error);
  }
};

// @desc    Get all comments for a ping
// @route   GET /api/pings/:pingId/comments
// @access  Public
export const getCommentsForPing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pingId } = req.params;

    // --- Pagination Logic ---
    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 50;
    if (limit > 100) limit = 100; // Cap the limit to 100
    const skip = (page - 1) * limit;

    // --- Filtering Logic ---
    const { organizationId } = req.query;
    const whereClause: any = {
      pingId: parseInt(pingId),
    };

    if (organizationId) {
      whereClause.organizationId = parseInt(organizationId as string);
    }

    // Verify the ping exists (and belongs to the organization if specified)
    const ping = await prisma.ping.findUnique({
      where: { 
        id: parseInt(pingId),
        ...(organizationId && { organizationId: parseInt(organizationId as string) }),
      },
    });

    if (!ping) {
      return res.status(404).json({ error: 'Ping not found' });
    }

    // Run two queries in parallel: one for the data, one for the total count
    const [comments, totalComments] = await prisma.$transaction([
      prisma.comment.findMany({
        where: whereClause,
        skip: skip,
        take: limit,
        orderBy: {
          createdAt: 'asc',
        },
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
      }),
      prisma.comment.count({ where: whereClause }),
    ]);

    // --- Metadata Calculation ---
    const totalPages = Math.ceil(totalComments / limit);

    return res.status(200).json({
      data: comments,
      pagination: {
        totalComments,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    logger.error('Error fetching comments for ping', { error, pingId: req.params.pingId });
    return next(error);
  }
};

// @desc    Create a new comment on a wave
// @route   POST /api/waves/:waveId/comments
// @access  Private
export const createCommentOnWave = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { waveId } = req.params;
    const { content } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Verify the wave exists and belongs to the user's organization
    const wave = await prisma.wave.findUnique({
      where: { 
        id: parseInt(waveId),
        organizationId: req.organizationId,
      },
    });

    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    const newComment = await prisma.comment.create({
      data: {
        content,
        authorId: userId,
        waveId: parseInt(waveId),
        organizationId: req.organizationId!,
      },
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
    });

    return res.status(201).json(newComment);
  } catch (error) {
    logger.error('Error creating comment on wave', { error, waveId: req.params.waveId, userId: req.user?.userId });
    return next(error);
  }
};

// @desc    Get all comments for a wave
// @route   GET /api/waves/:waveId/comments
// @access  Public
export const getCommentsForWave = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { waveId } = req.params;

    // Verify the wave exists and belongs to the user's organization
    const wave = await prisma.wave.findUnique({
      where: { 
        id: parseInt(waveId),
        organizationId: req.organizationId,
      },
    });

    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // --- Pagination Logic ---
    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 50;
    if (limit > 100) limit = 100; // Cap the limit to 100
    const skip = (page - 1) * limit;

    // Run two queries in parallel: one for the data, one for the total count
    const [comments, totalComments] = await prisma.$transaction([
      prisma.comment.findMany({
        where: {
          waveId: parseInt(waveId),
          organizationId: req.organizationId!,
        },
        skip: skip,
        take: limit,
        orderBy: {
          createdAt: 'asc',
        },
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
      }),
      prisma.comment.count({ 
        where: { 
          waveId: parseInt(waveId),
          organizationId: req.organizationId!,
        } 
      }),
    ]);

    // --- Metadata Calculation ---
    const totalPages = Math.ceil(totalComments / limit);

    return res.status(200).json({
      data: comments,
      pagination: {
        totalComments,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    logger.error('Error fetching comments for wave', { error, waveId: req.params.waveId });
    return next(error);
  }
};