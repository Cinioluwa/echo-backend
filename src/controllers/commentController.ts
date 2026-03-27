import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import logger from '../config/logger.js';
import { AuthRequest } from '../types/AuthRequest.js';
import { invalidateCacheAfterMutation } from '../utils/cacheInvalidation.js';
import { emitCommentOnPing, emitCommentOnWave } from '../utils/socketEmitter.js';

const sanitizeComment = (comment: any) => {
  if (!comment) return comment;
  if (comment.isAnonymous) {
    const { authorId, author, ...rest } = comment;
    return { ...rest, author: null };
  }
  return {
    ...comment,
    author: comment.author ?? null,
  };
};

// @desc    Create a new comment on a ping
// @route   POST /api/pings/:pingId/comments
// @access  Private
export const createCommentOnPing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { pingId } = req.params;
    const { content, isAnonymous = false } = req.body;
    const userId = req.user?.userId;
    const organizationId = req.user?.organizationId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Verify the ping exists in the user's org
    const ping = await prisma.ping.findFirst({
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
        organizationId: organizationId!,
        isAnonymous,
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

    const sanitizedComment = sanitizeComment(newComment);

    // Invalidate cache after creating comment
    await invalidateCacheAfterMutation(organizationId);

    // Emit real-time comment event
    emitCommentOnPing(parseInt(pingId), sanitizedComment);

    return res.status(201).json(sanitizedComment);
  } catch (error) {
    logger.error('Error creating comment on ping', { error, pingId: req.params.pingId, userId: req.user?.userId });
    return next(error);
  }
};

// @desc    Get all comments for a ping
// @route   GET /api/pings/:pingId/comments
// @access  Private
export const getCommentsForPing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { pingId } = req.params;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required.' });
    }

    // --- Pagination Logic ---
    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 50;
    if (limit > 100) limit = 100; // Cap the limit to 100
    const skip = (page - 1) * limit;

    // --- Filtering Logic ---
    const whereClause: any = {
      pingId: parseInt(pingId),
      organizationId: organizationId,
    };

    // Verify the ping exists in the user's org
    const ping = await prisma.ping.findFirst({
      where: { 
        id: parseInt(pingId),
        organizationId: organizationId,
      },
    });

    if (!ping) {
      return res.status(404).json({ error: 'Ping not found or access denied' });
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
          surges: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
      }),
      prisma.comment.count({ where: whereClause }),
    ]);

    // --- Metadata Calculation ---
    const totalPages = Math.ceil(totalComments / limit);

    // Sanitize and add hasSurged status
    const currentUserId = req.user?.userId;
    const sanitizedComments = comments.map((comment: any) => {
      const sanitized = sanitizeComment(comment);
      return {
        ...sanitized,
        hasSurged: comment.surges?.some((s: any) => s.userId === currentUserId) ?? false,
      };
    });

    return res.status(200).json({
      data: sanitizedComments,
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
    const { content, isAnonymous = false } = req.body;
    const userId = req.user?.userId;
    const organizationId = req.user?.organizationId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Verify the wave exists and belongs to the user's organization
    const wave = await prisma.wave.findFirst({
      where: { 
        id: parseInt(waveId),
        organizationId: organizationId,
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
        organizationId: organizationId!,
        isAnonymous,
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

    const sanitizedComment = sanitizeComment(newComment);

    // Invalidate cache after creating comment on wave
    await invalidateCacheAfterMutation(organizationId);

    // Emit real-time comment event
    emitCommentOnWave(parseInt(waveId), sanitizedComment);

    return res.status(201).json(sanitizedComment);
  } catch (error) {
    logger.error('Error creating comment on wave', { error, waveId: req.params.waveId, userId: req.user?.userId });
    return next(error);
  }
};

// @desc    Get all comments for a wave
// @route   GET /api/waves/:waveId/comments
// @access  Private
export const getCommentsForWave = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { waveId } = req.params;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required.' });
    }

    // Verify the wave exists and belongs to the user's organization
    const wave = await prisma.wave.findFirst({
      where: { 
        id: parseInt(waveId),
        organizationId: organizationId,
      },
    });

    if (!wave) {
      return res.status(404).json({ error: 'Wave not found or access denied' });
    }

    // --- Pagination Logic ---
    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 50;
    if (limit > 100) limit = 100; // Cap the limit to 100
    const skip = (page - 1) * limit;

    const whereClause = {
        waveId: parseInt(waveId),
        organizationId: organizationId,
    };

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
          surges: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
      }),
      prisma.comment.count({ where: whereClause }),
    ]);

    // --- Metadata Calculation ---
    const totalPages = Math.ceil(totalComments / limit);

    // Sanitize and add hasSurged status
    const currentUserId = req.user?.userId;
    const sanitizedComments = comments.map((comment: any) => {
      const sanitized = sanitizeComment(comment);
      return {
        ...sanitized,
        hasSurged: comment.surges?.some((s: any) => s.userId === currentUserId) ?? false,
      };
    });

    return res.status(200).json({
      data: sanitizedComments,
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

// @desc    Delete a comment
// @route   DELETE /api/comments/:commentId
// @access  Private (author or admin)
export const deleteComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.userId;
    const organizationId = req.user?.organizationId;
    const userRole = req.user?.role;

    if (!userId || !organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const comment = await prisma.comment.findFirst({
      where: {
        id: parseInt(commentId),
        organizationId,
      },
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only the author or an admin/super_admin can delete
    const isOwner = comment.authorId === userId;
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You are not authorized to delete this comment' });
    }

    await prisma.comment.delete({
      where: { id: parseInt(commentId) },
    });

    await invalidateCacheAfterMutation(organizationId);

    return res.status(204).send();
  } catch (error) {
    logger.error('Error deleting comment', { error, commentId: req.params.commentId, userId: req.user?.userId });
    return next(error);
  }
};