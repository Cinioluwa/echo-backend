import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';

/**
 * Blocks write operations (create ping, wave, comment) for users whose
 * moderationStatus is SUSPENDED (and still within the suspension window) or BANNED.
 *
 * Suspended/banned users can still READ — only their ability to post is restricted.
 * This middleware must be placed AFTER authMiddleware.
 */
const moderationMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { moderationStatus: true, suspendedUntil: true },
        });

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (user.moderationStatus === 'BANNED') {
            return res.status(403).json({
                error: 'Your posting privileges have been permanently restricted.',
                code: 'MODERATION_BANNED',
            });
        }

        if (user.moderationStatus === 'SUSPENDED') {
            const now = new Date();
            if (user.suspendedUntil && user.suspendedUntil > now) {
                return res.status(403).json({
                    error: 'Your posting privileges are temporarily restricted.',
                    code: 'MODERATION_SUSPENDED',
                    suspendedUntil: user.suspendedUntil,
                });
            }

            // Suspension has expired — automatically lift it
            await prisma.user.update({
                where: { id: userId },
                data: { moderationStatus: 'ACTIVE', suspendedUntil: null },
            });
        }

        return next();
    } catch (error) {
        return next(error);
    }
};

export default moderationMiddleware;
