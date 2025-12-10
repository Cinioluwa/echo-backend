import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { Status } from '@prisma/client';
import { AuthRequest } from '../types/AuthRequest.js';

const sanitizePingAuthor = (ping: any) => ({
    ...ping,
    author: ping?.isAnonymous ? null : ping?.author ?? null,
});

export const getSubmittedPings = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        let limit = parseInt(req.query.limit as string) || 20;
        if (limit > 100) limit = 100;
        const skip = (page - 1) * limit;

    const whereClause = { 
        status: Status.UNDER_REVIEW,
        organizationId: req.organizationId!,
    };

        const [pings, totalPings] = await prisma.$transaction([
            prisma.ping.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    author: {
                        select: {
                            email: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    _count: {
                        select: { waves: true, comments: true, surges: true },
                    },
                },
            }),
            prisma.ping.count({ where: whereClause }),
        ]);

        const totalPages = Math.ceil(totalPings / limit);

        const sanitizedPings = pings.map(sanitizePingAuthor);

        return res.status(200).json({
            data: sanitizedPings,
            pagination: {
                totalPings,
                totalPages,
                currentPage: page,
                limit,
            },
        });
    } catch (error) {
        return next(error);
    }
};

// GET /api/representatives/waves/top?days=7&take=3
export const getTopWavesForReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const days = req.query.days === 'all' ? 'all' : Number(req.query.days ?? 7);
        const since = days === 'all' ? undefined : new Date(Date.now() - (Number.isFinite(days) ? (days as number) : 7) * 24 * 60 * 60 * 1000);
        const take = Math.min(Number(req.query.take ?? 3), 20);

        const where: any = {
            organizationId: req.organizationId!,
        };
        if (since) where.createdAt = { gte: since };

        const waves = await prisma.wave.findMany({
            where,
            orderBy: [{ surgeCount: 'desc' }, { createdAt: 'desc' }],
            take,
            include: {
                ping: { select: { id: true, title: true, status: true } },
                _count: { select: { surges: true, comments: true } },
            },
        });

        return res.status(200).json({ data: waves });
    } catch (error) {
        return next(error);
    }
};

// POST /api/representatives/waves/forward  { waveIds: number[] }
export const forwardWaves = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { waveIds } = req.body as { waveIds: number[] };
        if (!Array.isArray(waveIds) || waveIds.length === 0) {
            return res.status(400).json({ error: 'waveIds array is required' });
        }

        // Update waves to flaggedForReview=true and mark who flagged (if available)
        const flaggedById = req.user?.userId ?? null;
        const updated = await prisma.wave.updateMany({
            where: { 
                id: { in: waveIds.map(Number).filter(Boolean) },
                organizationId: req.organizationId!,
            },
            data: { flaggedForReview: true, flaggedById },
        });

        return res.status(200).json({ message: 'Waves forwarded for review', count: updated.count });
    } catch (error) {
        return next(error);
    }
};