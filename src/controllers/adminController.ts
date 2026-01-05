import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { ProgressStatus, Status } from '@prisma/client';
import { AuthRequest } from '../types/AuthRequest.js';

export const getPlatformStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const [totalUsers, totalPings, totalSurges, totalWaves, totalComments, totalOrganizations] = await prisma.$transaction([
            prisma.user.count({ where: { organizationId: req.organizationId! } }),
            prisma.ping.count({ where: { organizationId: req.organizationId! } }),
            prisma.surge.count({ where: { organizationId: req.organizationId! } }),
            prisma.wave.count({ where: { organizationId: req.organizationId! } }),
            prisma.comment.count({ where: { organizationId: req.organizationId! } }),
            prisma.organization.count({ where: { id: req.organizationId! } }),
        ]);

        const stats = {
            totalUsers,
            totalPings,
            totalSurges,
            totalWaves,
            totalComments,
            totalOrganizations,
        };

        res.status(200).json(stats);  
    } catch (error) {
        return next(error);
    }
};

export const deleteAnyPing = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const pingId = parseInt(id);

        const ping = await prisma.ping.findFirst({
            where: { 
                id: pingId,
                organizationId: req.organizationId!,
            }
        });

        if (!ping) {
            return res.status(404).json({ error: 'Ping not found' });
        }

        await prisma.ping.deleteMany({
            where: { 
                id: pingId,
                organizationId: req.organizationId!,
            }
        });

        return res.status(204).send();
    } catch (error) {
        return next(error);
    }
};

export const getAllUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const users = await prisma.user.findMany({
            where: {
                organizationId: req.organizationId!,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                createdAt: true
            }
        });
        return res.status(200).json(users);
    } catch (error) {
        return next(error);
    }  
};

export const updateUserRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!['USER', 'ADMIN', 'REPRESENTATIVE'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role specified' });
        }

        const updateResult = await prisma.user.updateMany({
            where: { 
                id: parseInt(id),
                organizationId: req.organizationId!,
            },
            data: { role }
        });
        if (updateResult.count === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const safeUser = await prisma.user.findFirst({
            where: { id: parseInt(id), organizationId: req.organizationId! },
            select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true }
        });
        return res.status(200).json(safeUser);
    } catch (error) {
        return next(error);
    }
};

export const getPingsByLevel = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const pings = await prisma.ping.findMany({
            where: {
                organizationId: req.organizationId!,
            },
            select: {
                author: {
                    select: {
                        level: true
                    },
                },
            },
        });

        const statsByLevel = pings.reduce((acc, ping) => {
            const level = ping.author.level || 'Unknown';
            acc[level] = (acc[level] || 0) + 1;
            return acc;
        }, {} as Record<string | number, number>);

        const formattedStats = Object.entries(statsByLevel).map(([level, count]) => ({
            name: `Level ${level}`,
            value: count,
        }));
        
        return res.status(200).json(formattedStats);
    } catch (error) {
        return next(error);
    }
};


export const getPingStatsByCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await prisma.ping.groupBy({
      where: {
        organizationId: req.organizationId!,
      },
      by: ['categoryId'],
      _count: {
        id: true, 
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    // Get category names for the IDs
    const categoryIds = stats.map(item => item.categoryId).filter(id => id !== null);
    const categories = await prisma.category.findMany({
      where: {
        id: { in: categoryIds },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const categoryMap = new Map(categories.map(cat => [cat.id, cat.name]));

    const formattedStats = stats.map(item => ({
      name: item.categoryId ? categoryMap.get(item.categoryId) || 'Unknown' : 'No Category',
      count: item._count.id,
    }));

    return res.status(200).json(formattedStats);
  } catch (error) {
    return next(error);
  }
};

export const getUserByIdAsAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const userId = parseInt(id);
        const user = await prisma.user.findFirst({
            where: { 
                id: userId,
                organizationId: req.organizationId!,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                level: true,
                createdAt: true,

                pings: {
                    orderBy: { createdAt: 'desc' },
                },

                comments: {
                    orderBy: { createdAt: 'desc' },
                },
                surges: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.status(200).json(user);
    } catch (error) {
        return next(error);
    }
};

export const updatePingProgressStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { status } = req.body as { status: ProgressStatus };

        if (!Object.values(ProgressStatus).includes(status)) {
            return res.status(400).json({ error: 'Invalid progress status' });
        }

        const updateResult = await prisma.ping.updateMany({
            where: { 
                id: parseInt(id),
                organizationId: req.organizationId!,
            },
            data: { progressStatus: status, progressUpdatedAt: new Date() },
        });
        if (updateResult.count === 0) {
            return res.status(404).json({ error: 'Ping not found' });
        }
        const updated = await prisma.ping.findFirst({
            where: { id: parseInt(id), organizationId: req.organizationId! },
            select: { id: true, title: true, progressStatus: true, progressUpdatedAt: true }
        });
        return res.status(200).json(updated);
    } catch (error) {
        return next(error);
    }
};

export const acknowledgePing = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const pingId = parseInt(id);

        const ping = await prisma.ping.findFirst({
            where: {
                id: pingId,
                organizationId: req.organizationId!,
            },
            select: {
                id: true,
                acknowledgedAt: true,
                progressStatus: true,
                progressUpdatedAt: true,
            }
        });

        if (!ping) {
            return res.status(404).json({ error: 'Ping not found' });
        }

        if (ping.acknowledgedAt) {
            return res.status(200).json(ping);
        }

        const now = new Date();
        const shouldBumpProgress = ping.progressStatus === ProgressStatus.NONE;

        const updated = await prisma.ping.update({
            where: { id: pingId },
            data: {
                acknowledgedAt: now,
                ...(shouldBumpProgress
                    ? { progressStatus: ProgressStatus.ACKNOWLEDGED, progressUpdatedAt: now }
                    : {}),
            },
            select: {
                id: true,
                acknowledgedAt: true,
                progressStatus: true,
                progressUpdatedAt: true,
            }
        });

        return res.status(200).json(updated);
    } catch (error) {
        return next(error);
    }
};

export const resolvePing = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const pingId = parseInt(id);

        const ping = await prisma.ping.findFirst({
            where: {
                id: pingId,
                organizationId: req.organizationId!,
            },
            select: {
                id: true,
                resolvedAt: true,
                progressStatus: true,
                progressUpdatedAt: true,
            }
        });

        if (!ping) {
            return res.status(404).json({ error: 'Ping not found' });
        }

        if (ping.resolvedAt) {
            return res.status(200).json(ping);
        }

        const now = new Date();

        const updated = await prisma.$transaction(async (tx) => {
            const updatedPing = await tx.ping.update({
                where: { id: pingId },
                data: {
                    resolvedAt: now,
                    progressStatus: ProgressStatus.RESOLVED,
                    progressUpdatedAt: now,
                },
                select: {
                    id: true,
                    resolvedAt: true,
                    progressStatus: true,
                    progressUpdatedAt: true,
                }
            });

            // Keep OfficialResponse in sync if it exists
            await tx.officialResponse.updateMany({
                where: { pingId },
                data: { isResolved: true },
            });

            return updatedPing;
        });

        return res.status(200).json(updated);
    } catch (error) {
        return next(error);
    }
};

export const getResponseTimeAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const days = req.query.days ? parseInt(req.query.days as string) : 30;
        const windowDays = Number.isFinite(days) && days > 0 ? Math.min(days, 365) : 30;
        const from = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

        const pings = await prisma.ping.findMany({
            where: {
                organizationId: req.organizationId!,
                createdAt: { gte: from },
            },
            select: {
                id: true,
                createdAt: true,
                acknowledgedAt: true,
                resolvedAt: true,
                categoryId: true,
                category: { select: { name: true } },
            },
        });

        const calcAvg = (values: number[]) => {
            if (!values.length) return null;
            return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        };

        const overallAck: number[] = [];
        const overallResolve: number[] = [];

        type Bucket = {
            categoryId: number;
            categoryName: string;
            totalPings: number;
            acknowledgedCount: number;
            resolvedCount: number;
            ackMs: number[];
            resolveMs: number[];
        };

        const byCategory = new Map<number, Bucket>();

        for (const ping of pings) {
            const categoryId = ping.categoryId;
            const categoryName = ping.category?.name ?? 'Unknown';

            let bucket = byCategory.get(categoryId);
            if (!bucket) {
                bucket = {
                    categoryId,
                    categoryName,
                    totalPings: 0,
                    acknowledgedCount: 0,
                    resolvedCount: 0,
                    ackMs: [],
                    resolveMs: [],
                };
                byCategory.set(categoryId, bucket);
            }

            bucket.totalPings += 1;

            if (ping.acknowledgedAt) {
                const ms = ping.acknowledgedAt.getTime() - ping.createdAt.getTime();
                if (ms >= 0) {
                    overallAck.push(ms);
                    bucket.ackMs.push(ms);
                }
                bucket.acknowledgedCount += 1;
            }

            if (ping.resolvedAt) {
                const ms = ping.resolvedAt.getTime() - ping.createdAt.getTime();
                if (ms >= 0) {
                    overallResolve.push(ms);
                    bucket.resolveMs.push(ms);
                }
                bucket.resolvedCount += 1;
            }
        }

        const byCategoryOut = Array.from(byCategory.values())
            .map((b) => ({
                categoryId: b.categoryId,
                categoryName: b.categoryName,
                totalPings: b.totalPings,
                acknowledgedCount: b.acknowledgedCount,
                resolvedCount: b.resolvedCount,
                avgMsToAcknowledge: calcAvg(b.ackMs),
                avgMsToResolve: calcAvg(b.resolveMs),
            }))
            .sort((a, b) => b.totalPings - a.totalPings);

        return res.status(200).json({
            windowDays,
            totalPings: pings.length,
            acknowledgedCount: overallAck.length,
            resolvedCount: overallResolve.length,
            avgMsToAcknowledge: calcAvg(overallAck),
            avgMsToResolve: calcAvg(overallResolve),
            byCategory: byCategoryOut,
        });
    } catch (error) {
        return next(error);
    }
};

export const getAllWavesAsAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const organizationId = req.organizationId!;

        const page = parseInt(req.query.page as string) || 1;
        let limit = parseInt(req.query.limit as string) || 20;
        if (limit > 100) limit = 100;
        const skip = (page - 1) * limit;

        const status = req.query.status as string | undefined;
        const where: any = { organizationId };
        if (status && (Object.values(Status) as string[]).includes(status)) {
            where.status = status as Status;
        }

        const [waves, totalWaves] = await prisma.$transaction([
            prisma.wave.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    ping: { select: { id: true, title: true, progressStatus: true } },
                    flaggedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
                    _count: { select: { surges: true, comments: true } },
                },
            }),
            prisma.wave.count({ where }),
        ]);

        const totalPages = Math.ceil(totalWaves / limit);

        return res.status(200).json({
            data: waves,
            pagination: {
                totalWaves,
                totalPages,
                currentPage: page,
                limit,
            },
        });
    } catch (error) {
        return next(error);
    }
};

export const updateWaveStatusAsAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const organizationId = req.organizationId!;
        const waveId = parseInt(req.params.id);
        const { status } = req.body as { status: Status };

        if (!Object.values(Status).includes(status)) {
            return res.status(400).json({ error: 'Invalid wave status' });
        }

        const wave = await prisma.wave.findFirst({
            where: { id: waveId, organizationId },
            select: { id: true, pingId: true, status: true },
        });

        if (!wave) {
            return res.status(404).json({ error: 'Wave not found' });
        }

        const now = new Date();

        const updated = await prisma.$transaction(async (tx) => {
            const updatedWave = await tx.wave.update({
                where: { id: waveId },
                data: {
                    status,
                    flaggedForReview: status === Status.UNDER_REVIEW,
                },
                select: {
                    id: true,
                    pingId: true,
                    status: true,
                    flaggedForReview: true,
                },
            });

            // Product rule: approving a wave resolves its parent ping.
            if (status === Status.APPROVED) {
                await tx.ping.updateMany({
                    where: { id: updatedWave.pingId, organizationId },
                    data: {
                        resolvedAt: now,
                        progressStatus: ProgressStatus.RESOLVED,
                        progressUpdatedAt: now,
                    },
                });

                await tx.officialResponse.updateMany({
                    where: { pingId: updatedWave.pingId, organizationId },
                    data: { isResolved: true },
                });
            }

            return updatedWave;
        });

        return res.status(200).json(updated);
    } catch (error) {
        return next(error);
    }
};
