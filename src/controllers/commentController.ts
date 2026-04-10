import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import logger from '../config/logger.js';
import { AuthRequest } from '../types/AuthRequest.js';
import { invalidateCacheAfterMutation } from '../utils/cacheInvalidation.js';
import { emitCommentOnPing, emitCommentOnWave, emitCommentReplyOnPing } from '../utils/socketEmitter.js';
import { emitNotification } from '../utils/socketEmitter.js';

// ─── Author select shape (reused everywhere) ───────────────────────────────
const AUTHOR_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  displayName: true,
  profilePicture: true,
} as const;

// ─── Sanitize anonymous comments ───────────────────────────────────────────
const sanitizeComment = (comment: any) => {
  if (!comment) return comment;
  if (comment.isAnonymous) {
    const { authorId, author, ...rest } = comment;
    return { ...rest, author: null, anonymousAlias: comment.anonymousAlias ?? null };
  }
  return {
    ...comment,
    author: comment.author ?? null,
  };
};

// ─── Helper: attach hasSurged to a (sanitized) comment ────────────────────
const withSurged = (comment: any, currentUserId: number | undefined) => ({
  ...comment,
  hasSurged: comment.surges?.some((s: any) => s.userId === currentUserId) ?? false,
});

// ──────────────────────────────────────────────────────────────────────────
// Create a comment on a ping
// POST /api/pings/:pingId/comments
// ──────────────────────────────────────────────────────────────────────────
export const createCommentOnPing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { pingId } = req.params;
    const { content, isAnonymous = false } = req.body;
    const userId = req.user?.userId;
    const organizationId = req.user?.organizationId;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!content) return res.status(400).json({ error: 'Comment content is required' });

    const ping = await prisma.ping.findFirst({
      where: { id: parseInt(pingId), organizationId },
    });
    if (!ping) return res.status(404).json({ error: 'Ping not found or access denied' });

    const isAnonymousPost = Boolean(isAnonymous);
    let anonymousAlias: string | null = null;
    if (isAnonymousPost) {
      const prefs = await prisma.userPreference.findUnique({
        where: { userId },
        select: { anonymousAlias: true },
      });
      anonymousAlias = prefs?.anonymousAlias ?? null;
    }

    const newComment = await prisma.comment.create({
      data: {
        content,
        authorId: userId,
        pingId: parseInt(pingId),
        organizationId: organizationId!,
        isAnonymous: isAnonymousPost,
        anonymousAlias,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });

    const sanitizedComment = sanitizeComment(newComment);
    await invalidateCacheAfterMutation(organizationId);
    emitCommentOnPing(parseInt(pingId), sanitizedComment);

    return res.status(201).json(sanitizedComment);
  } catch (error) {
    logger.error('Error creating comment on ping', { error, pingId: req.params.pingId, userId: req.user?.userId });
    return next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Get all comments for a ping (threaded — top-level + nested replies)
// GET /api/pings/:pingId/comments
// ──────────────────────────────────────────────────────────────────────────
export const getCommentsForPing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { pingId } = req.params;
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(400).json({ error: 'Organization ID is required.' });

    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 50;
    if (limit > 100) limit = 100;
    const skip = (page - 1) * limit;
    const pingIdInt = parseInt(pingId);

    const ping = await prisma.ping.findFirst({
      where: { id: pingIdInt, organizationId },
    });
    if (!ping) return res.status(404).json({ error: 'Ping not found or access denied' });

    // Only count/fetch TOP-LEVEL comments (parentCommentId === null)
    const whereClause = {
      pingId: pingIdInt,
      organizationId,
      parentCommentId: null,
    };

    const [comments, totalComments] = await prisma.$transaction([
      prisma.comment.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: AUTHOR_SELECT },
          surges: { select: { id: true, userId: true } },
          // One level of replies
          replies: {
            orderBy: { createdAt: 'asc' },
            include: {
              author: { select: AUTHOR_SELECT },
              surges: { select: { id: true, userId: true } },
            },
          },
        },
      }),
      prisma.comment.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(totalComments / limit);
    const currentUserId = req.user?.userId;

    const sanitizedComments = comments.map((comment: any) => {
      const sanitized = withSurged(sanitizeComment(comment), currentUserId);
      const sanitizedReplies = (comment.replies ?? []).map((reply: any) =>
        withSurged(sanitizeComment(reply), currentUserId)
      );
      return {
        ...sanitized,
        replies: sanitizedReplies,
        replyCount: sanitizedReplies.length,
      };
    });

    return res.status(200).json({
      data: sanitizedComments,
      pagination: { totalComments, totalPages, currentPage: page, limit },
    });
  } catch (error) {
    logger.error('Error fetching comments for ping', { error, pingId: req.params.pingId });
    return next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Create a reply to a top-level comment on a ping
// POST /api/pings/:pingId/comments/:commentId/replies
// ──────────────────────────────────────────────────────────────────────────
export const createReplyOnPingComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { pingId, commentId } = req.params;
    const { content, isAnonymous = false } = req.body;
    const userId = req.user?.userId;
    const organizationId = req.user?.organizationId;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const pingIdInt = parseInt(pingId);
    const commentIdInt = parseInt(commentId);

    // Verify the ping exists
    const ping = await prisma.ping.findFirst({
      where: { id: pingIdInt, organizationId },
    });
    if (!ping) return res.status(404).json({ error: 'Ping not found or access denied' });

    // Verify parent comment exists, belongs to this ping, is top-level
    const parentComment = await prisma.comment.findFirst({
      where: { id: commentIdInt, pingId: pingIdInt, organizationId },
    });
    if (!parentComment) return res.status(404).json({ error: 'Comment not found' });

    // Enforce single-level threading
    if (parentComment.parentCommentId !== null) {
      return res.status(400).json({
        error: 'Cannot reply to a reply. Replies are limited to one level deep.',
      });
    }

    const isAnonymousPost = Boolean(isAnonymous);
    let anonymousAlias: string | null = null;
    if (isAnonymousPost) {
      const prefs = await prisma.userPreference.findUnique({
        where: { userId },
        select: { anonymousAlias: true },
      });
      anonymousAlias = prefs?.anonymousAlias ?? null;
    }

    const newReply = await prisma.comment.create({
      data: {
        content,
        authorId: userId,
        pingId: pingIdInt,
        organizationId: organizationId!,
        isAnonymous: isAnonymousPost,
        anonymousAlias,
        parentCommentId: commentIdInt,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });

    const sanitizedReply = sanitizeComment(newReply);
    await invalidateCacheAfterMutation(organizationId);
    emitCommentReplyOnPing(pingIdInt, commentIdInt, sanitizedReply);

    // ── COMMENT_REPLY notification ──────────────────────────────────────
    // Notify parent comment author — unless they wrote the reply themselves,
    // or the parent comment is anonymous (we don't know who to notify).
    if (parentComment.authorId !== userId && !parentComment.isAnonymous) {
      try {
        // Check recipient's preference
        const prefs = await prisma.notificationPreference.findUnique({
          where: { userId: parentComment.authorId },
          select: { commentReply: true },
        });

        const wantsNotification = prefs ? prefs.commentReply : true; // default on

        if (wantsNotification) {
          const replier = await prisma.user.findUnique({
            where: { id: userId },
            select: { firstName: true, lastName: true, displayName: true },
          });
          const replierName = replier?.displayName
            ?? (replier ? `${replier.firstName ?? ''} ${replier.lastName ?? ''}`.trim() : 'Someone');
          const displayName = isAnonymous ? 'Someone' : replierName;

          const notification = await prisma.notification.create({
            data: {
              type: 'COMMENT_REPLY',
              title: 'New reply on your comment',
              body: `${displayName} replied: "${content.length > 80 ? content.slice(0, 80) + '…' : content}"`,
              userId: parentComment.authorId,
              organizationId: organizationId!,
              pingId: pingIdInt,
              commentId: newReply.id,
            },
          });

          emitNotification(parentComment.authorId, notification);
        }
      } catch (notifError) {
        // Notifications are best-effort — don't fail the reply creation
        logger.warn('Failed to create COMMENT_REPLY notification', { notifError, replyId: newReply.id });
      }
    }

    return res.status(201).json(sanitizedReply);
  } catch (error) {
    logger.error('Error creating reply on ping comment', {
      error,
      pingId: req.params.pingId,
      commentId: req.params.commentId,
      userId: req.user?.userId,
    });
    return next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Create a comment on a wave (flat, no replies)
// POST /api/waves/:waveId/comments
// ──────────────────────────────────────────────────────────────────────────
export const createCommentOnWave = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { waveId } = req.params;
    const { content, isAnonymous = false } = req.body;
    const userId = req.user?.userId;
    const organizationId = req.user?.organizationId;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!content) return res.status(400).json({ error: 'Comment content is required' });

    const wave = await prisma.wave.findFirst({
      where: { id: parseInt(waveId), organizationId },
    });
    if (!wave) return res.status(404).json({ error: 'Wave not found' });

    const isAnonymousPost = Boolean(isAnonymous);
    let anonymousAlias: string | null = null;
    if (isAnonymousPost) {
      const prefs = await prisma.userPreference.findUnique({
        where: { userId },
        select: { anonymousAlias: true },
      });
      anonymousAlias = prefs?.anonymousAlias ?? null;
    }

    const newComment = await prisma.comment.create({
      data: {
        content,
        authorId: userId,
        waveId: parseInt(waveId),
        organizationId: organizationId!,
        isAnonymous: isAnonymousPost,
        anonymousAlias,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });

    const sanitizedComment = sanitizeComment(newComment);
    await invalidateCacheAfterMutation(organizationId);
    emitCommentOnWave(parseInt(waveId), sanitizedComment);

    return res.status(201).json(sanitizedComment);
  } catch (error) {
    logger.error('Error creating comment on wave', { error, waveId: req.params.waveId, userId: req.user?.userId });
    return next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Get all comments for a wave (flat — no threading on waves)
// GET /api/waves/:waveId/comments
// ──────────────────────────────────────────────────────────────────────────
export const getCommentsForWave = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { waveId } = req.params;
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(400).json({ error: 'Organization ID is required.' });

    const wave = await prisma.wave.findFirst({
      where: { id: parseInt(waveId), organizationId },
    });
    if (!wave) return res.status(404).json({ error: 'Wave not found or access denied' });

    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 50;
    if (limit > 100) limit = 100;
    const skip = (page - 1) * limit;

    const whereClause = { waveId: parseInt(waveId), organizationId };

    const [comments, totalComments] = await prisma.$transaction([
      prisma.comment.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: AUTHOR_SELECT },
          surges: { select: { id: true, userId: true } },
        },
      }),
      prisma.comment.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(totalComments / limit);
    const currentUserId = req.user?.userId;

    const sanitizedComments = comments.map((comment: any) =>
      withSurged(sanitizeComment(comment), currentUserId)
    );

    return res.status(200).json({
      data: sanitizedComments,
      pagination: { totalComments, totalPages, currentPage: page, limit },
    });
  } catch (error) {
    logger.error('Error fetching comments for wave', { error, waveId: req.params.waveId });
    return next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Delete a comment (author or admin; cascades to replies)
// DELETE /api/comments/:commentId
// ──────────────────────────────────────────────────────────────────────────
export const deleteComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.userId;
    const organizationId = req.user?.organizationId;
    const userRole = req.user?.role;

    if (!userId || !organizationId) return res.status(401).json({ error: 'Unauthorized' });

    const comment = await prisma.comment.findFirst({
      where: { id: parseInt(commentId), organizationId },
    });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const isOwner = comment.authorId === userId;
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You are not authorized to delete this comment' });
    }

    // Authors cannot delete their own anonymous comments
    if (isOwner && comment.isAnonymous && !isAdmin) {
      return res.status(403).json({
        error: 'Anonymous comments cannot be deleted by their author',
        code:  'ANONYMOUS_DELETE_FORBIDDEN',
      });
    }

    await prisma.comment.delete({ where: { id: parseInt(commentId) } });
    await invalidateCacheAfterMutation(organizationId);

    return res.status(204).send();
  } catch (error) {
    logger.error('Error deleting comment', { error, commentId: req.params.commentId, userId: req.user?.userId });
    return next(error);
  }
};