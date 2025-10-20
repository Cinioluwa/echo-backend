import { Request, Response } from 'express';
import prisma from '../config/db.js';
import logger from '../config/logger.js';
import { AuthRequest } from '../types/AuthRequest.js';

// @desc    Create a new comment on a ping
// @route   POST /api/pings/:pingId/comments
// @access  Private
export const createCommentOnPing = async (req: AuthRequest, res: Response) => {
  try {
    const { pingId } = req.params;
    const { content } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Verify the ping exists
    const ping = await prisma.ping.findUnique({
      where: { id: parseInt(pingId) },
    });

    if (!ping) {
      return res.status(404).json({ error: 'Ping not found' });
    }

    const newComment = await prisma.comment.create({
      data: {
        content,
        authorId: userId,
        pingId: parseInt(pingId),
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
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// @desc    Get all comments for a ping
// @route   GET /api/pings/:pingId/comments
// @access  Public
export const getCommentsForPing = async (req: Request, res: Response) => {
  try {
    const { pingId } = req.params;

    const comments = await prisma.comment.findMany({
      where: {
        pingId: parseInt(pingId),
      },
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
    });

    return res.status(200).json(comments);
  } catch (error) {
    logger.error('Error fetching comments for ping', { error, pingId: req.params.pingId });
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// @desc    Create a new comment on a wave
// @route   POST /api/waves/:waveId/comments
// @access  Private
export const createCommentOnWave = async (req: AuthRequest, res: Response) => {
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

    // Verify the wave exists
    const wave = await prisma.wave.findUnique({
      where: { id: parseInt(waveId) },
    });

    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    const newComment = await prisma.comment.create({
      data: {
        content,
        authorId: userId,
        waveId: parseInt(waveId),
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
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// @desc    Get all comments for a wave
// @route   GET /api/waves/:waveId/comments
// @access  Public
export const getCommentsForWave = async (req: Request, res: Response) => {
  try {
    const { waveId } = req.params;

    const comments = await prisma.comment.findMany({
      where: {
        waveId: parseInt(waveId),
      },
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
    });

    return res.status(200).json(comments);
  } catch (error) {
    logger.error('Error fetching comments for wave', { error, waveId: req.params.waveId });
    return res.status(500).json({ error: 'Something went wrong' });
  }
};