import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { ProgressStatus, Status } from '@prisma/client';
import { AuthRequest } from '../types/AuthRequest.js';
import Sentiment from 'sentiment';
import { sendEmail } from '../services/emailService.js';
import { createNotification } from '../services/notificationService.js';

const DAYS_IN_WEEK = 7;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

type WeekWindow = {
    start: Date;
    end: Date;
    weeks: number;
    offsetWeeks: number;
};

const clampInt = (value: unknown, fallback: number, min: number, max: number) => {
    const parsed = typeof value === 'string' ? parseInt(value, 10) : Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const asInt = Math.trunc(parsed);
    if (asInt < min) return min;
    if (asInt > max) return max;
    return asInt;
};

const getWeekWindowFromQuery = (query: AuthRequest['query']): WeekWindow | null => {
    const hasWeeks = query.weeks !== undefined;
    const hasOffset = query.offsetWeeks !== undefined;

    if (!hasWeeks && !hasOffset) return null;

    const weeks = clampInt(query.weeks, 1, 1, 52);
    const offsetWeeks = clampInt(query.offsetWeeks, 0, 0, 520);

    const now = Date.now();
    const endMs = now - offsetWeeks * DAYS_IN_WEEK * MS_IN_DAY;
    const startMs = endMs - weeks * DAYS_IN_WEEK * MS_IN_DAY;

    return {
        start: new Date(startMs),
        end: new Date(endMs),
        weeks,
        offsetWeeks,
    };
};

export const getPlatformStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const window = getWeekWindowFromQuery(req.query);

        const createdAtFilter = window
            ? { createdAt: { gte: window.start, lt: window.end } }
            : undefined;

        const [totalUsers, totalPings, totalSurges, totalWaves, totalComments, totalOrganizations] = await prisma.$transaction([
            prisma.user.count({ where: { organizationId: req.organizationId!, ...(createdAtFilter ?? {}) } }),
            prisma.ping.count({ where: { organizationId: req.organizationId!, ...(createdAtFilter ?? {}) } }),
            prisma.surge.count({ where: { organizationId: req.organizationId!, ...(createdAtFilter ?? {}) } }),
            prisma.wave.count({ where: { organizationId: req.organizationId!, ...(createdAtFilter ?? {}) } }),
            prisma.comment.count({ where: { organizationId: req.organizationId!, ...(createdAtFilter ?? {}) } }),
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

        res.status(200).json({
            ...stats,
            ...(window
                ? {
                    window: {
                        weeks: window.weeks,
                        offsetWeeks: window.offsetWeeks,
                        start: window.start,
                        end: window.end,
                    },
                }
                : {}),
        });
    } catch (error) {
        return next(error);
    }
};

export const getActiveUsersAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const organizationId = req.organizationId!;

        // This route uses validation middleware (weeks/offsetWeeks are coerced),
        // but keep safe defaults in case of direct calls.
        const weeks = clampInt(req.query.weeks, 1, 1, 52);
        const offsetWeeks = clampInt(req.query.offsetWeeks, 0, 0, 520);

        const now = Date.now();
        const end = new Date(now - offsetWeeks * DAYS_IN_WEEK * MS_IN_DAY);
        const start = new Date(end.getTime() - weeks * DAYS_IN_WEEK * MS_IN_DAY);

        const createdAt = { gte: start, lt: end };

        const [pingAuthors, commentAuthors, surgeUsers, responseAuthors] = await prisma.$transaction([
            prisma.ping.findMany({
                where: { organizationId, createdAt },
                select: { authorId: true },
                distinct: ['authorId'],
            }),
            prisma.comment.findMany({
                where: { organizationId, createdAt },
                select: { authorId: true },
                distinct: ['authorId'],
            }),
            prisma.surge.findMany({
                where: { organizationId, createdAt },
                select: { userId: true },
                distinct: ['userId'],
            }),
            prisma.officialResponse.findMany({
                where: { organizationId, createdAt },
                select: { authorId: true },
                distinct: ['authorId'],
            }),
        ]);

        const activeUserIds = new Set<number>();
        for (const row of pingAuthors) activeUserIds.add(row.authorId);
        for (const row of commentAuthors) activeUserIds.add(row.authorId);
        for (const row of surgeUsers) activeUserIds.add(row.userId);
        for (const row of responseAuthors) activeUserIds.add(row.authorId);

        return res.status(200).json({
            weeks,
            offsetWeeks,
            start,
            end,
            activeUsers: activeUserIds.size,
        });
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
        const window = getWeekWindowFromQuery(req.query);
        const createdAtFilter = window ? { createdAt: { gte: window.start, lt: window.end } } : undefined;

        const pings = await prisma.ping.findMany({
            where: {
                organizationId: req.organizationId!,
                ...(createdAtFilter ?? {}),
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
        const window = getWeekWindowFromQuery(req.query);
        const createdAtFilter = window ? { createdAt: { gte: window.start, lt: window.end } } : undefined;

        const stats = await prisma.ping.groupBy({
            where: {
                organizationId: req.organizationId!,
                ...(createdAtFilter ?? {}),
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

        const pingForNotify =
            status === Status.APPROVED
                ? await prisma.ping.findFirst({
                    where: { id: wave.pingId, organizationId },
                    select: {
                        id: true,
                        title: true,
                        authorId: true,
                        author: { select: { email: true, firstName: true } },
                    },
                })
                : null;

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

                if (pingForNotify) {
                    await createNotification(tx as any, {
                        userId: pingForNotify.authorId,
                        organizationId,
                        type: 'WAVE_APPROVED',
                        title: 'Wave approved',
                        body: `A wave was approved for: ${pingForNotify.title}`,
                        pingId: pingForNotify.id,
                        waveId: updatedWave.id,
                    });
                }
            }

            return updatedWave;
        });

        if (status === Status.APPROVED && pingForNotify?.author?.email) {
            const to = pingForNotify.author.email;
            const subject = 'A wave was approved on your Echo ping';
            const html = `<p>Hi${pingForNotify.author.firstName ? ` ${pingForNotify.author.firstName}` : ''},</p>
<p>A wave was approved for your ping:</p>
<p><strong>${pingForNotify.title}</strong></p>
<p>You can open Echo to see the update.</p>`;
            setImmediate(() => {
                sendEmail({ to, subject, html }).catch(() => {
                    // Best-effort.
                });
            });
        }

        return res.status(200).json(updated);
    } catch (error) {
        return next(error);
    }
};

export const getTrendingCategories = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const organizationId = req.organizationId!;

        const window =
            getWeekWindowFromQuery(req.query) ??
            (() => {
                const now = Date.now();
                const end = new Date(now);
                const start = new Date(now - DAYS_IN_WEEK * MS_IN_DAY);
                return { start, end, weeks: 1, offsetWeeks: 0 };
            })();

        const durationMs = window.end.getTime() - window.start.getTime();
        const previousEnd = window.start;
        const previousStart = new Date(previousEnd.getTime() - durationMs);

        const createdAtCurrent = { gte: window.start, lt: window.end };
        const createdAtPrevious = { gte: previousStart, lt: previousEnd };

        const [currentRows, previousRows] = await prisma.$transaction([
            prisma.ping.findMany({
                where: { organizationId, createdAt: createdAtCurrent },
                select: { categoryId: true },
            }),
            prisma.ping.findMany({
                where: { organizationId, createdAt: createdAtPrevious },
                select: { categoryId: true },
            }),
        ]);

        const countByCategory = (rows: Array<{ categoryId: number }>) => {
            const out = new Map<number, number>();
            for (const row of rows) out.set(row.categoryId, (out.get(row.categoryId) ?? 0) + 1);
            return out;
        };

        const currentMap = countByCategory(currentRows);
        const previousMap = countByCategory(previousRows);

        const categoryIds = Array.from(currentMap.keys());
        const categories = categoryIds.length
            ? await prisma.category.findMany({
                where: { id: { in: categoryIds } },
                select: { id: true, name: true },
            })
            : [];
        const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

        const data = categoryIds
            .map((categoryId) => {
                const currentCount = currentMap.get(categoryId) ?? 0;
                const previousCount = previousMap.get(categoryId) ?? 0;
                const delta = currentCount - previousCount;
                const percentChange = previousCount === 0 ? null : (delta / previousCount) * 100;

                return {
                    categoryId,
                    categoryName: categoryNameById.get(categoryId) ?? 'Unknown',
                    currentCount,
                    previousCount,
                    delta,
                    percentChange,
                    isNew: previousCount === 0 && currentCount > 0,
                };
            })
            .sort((a, b) => b.delta - a.delta || b.currentCount - a.currentCount);

        return res.status(200).json({
            window: {
                weeks: window.weeks,
                offsetWeeks: window.offsetWeeks,
                start: window.start,
                end: window.end,
            },
            comparisonWindow: {
                start: previousStart,
                end: previousEnd,
            },
            data,
        });
    } catch (error) {
        return next(error);
    }
};

export const getPriorityPings = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const organizationId = req.organizationId!;

        const weeks = clampInt(req.query.weeks, 1, 1, 52);
        const offsetWeeks = clampInt(req.query.offsetWeeks, 0, 0, 520);
        const limit = clampInt(req.query.limit, 20, 1, 100);

        const now = Date.now();
        const end = new Date(now - offsetWeeks * DAYS_IN_WEEK * MS_IN_DAY);
        const start = new Date(end.getTime() - weeks * DAYS_IN_WEEK * MS_IN_DAY);

        // Pull a slightly larger candidate set for scoring, then slice to requested limit.
        const candidateTake = Math.min(100, Math.max(limit * 5, limit));

        const candidates = await prisma.ping.findMany({
            where: {
                organizationId,
                createdAt: { gte: start, lt: end },
                progressStatus: { not: ProgressStatus.RESOLVED },
            },
            take: candidateTake,
            orderBy: [{ surgeCount: 'desc' }, { createdAt: 'desc' }],
            include: {
                category: { select: { id: true, name: true } },
                author: { select: { email: true, firstName: true, lastName: true } },
                _count: { select: { waves: true, comments: true, surges: true } },
            },
        });

        const scored = candidates
            .map((ping) => {
                const waves = ping._count.waves;
                const comments = ping._count.comments;
                const surges = ping.surgeCount;

                // MVP scoring: engagement-weighted. (No LLMs, no hidden heuristics.)
                const priorityScore = surges * 3 + comments * 2 + waves;

                return {
                    ...ping,
                    priorityScore,
                };
            })
            .sort((a, b) => b.priorityScore - a.priorityScore || b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);

        return res.status(200).json({
            window: {
                weeks,
                offsetWeeks,
                start,
                end,
            },
            limit,
            data: scored,
        });
    } catch (error) {
        return next(error);
    }
};

export const getPingSentimentAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const organizationId = req.organizationId!;

        const weeks = clampInt(req.query.weeks, 1, 1, 52);
        const offsetWeeks = clampInt(req.query.offsetWeeks, 0, 0, 520);

        const now = Date.now();
        const end = new Date(now - offsetWeeks * DAYS_IN_WEEK * MS_IN_DAY);
        const start = new Date(end.getTime() - weeks * DAYS_IN_WEEK * MS_IN_DAY);

        const pings = await prisma.ping.findMany({
            where: {
                organizationId,
                createdAt: { gte: start, lt: end },
            },
            select: {
                id: true,
                title: true,
                content: true,
                createdAt: true,
            },
        });

        const sentiment = new Sentiment();

        let positive = 0;
        let neutral = 0;
        let negative = 0;
        let sumScore = 0;

        for (const ping of pings) {
            const text = `${ping.title}. ${ping.content}`;
            const result = sentiment.analyze(text);
            sumScore += result.score;

            if (result.score > 0) positive += 1;
            else if (result.score < 0) negative += 1;
            else neutral += 1;
        }

        const total = pings.length;
        const pct = (count: number) => (total === 0 ? 0 : (count / total) * 100);

        return res.status(200).json({
            window: {
                weeks,
                offsetWeeks,
                start,
                end,
            },
            totalPings: total,
            averageScore: total === 0 ? 0 : sumScore / total,
            counts: {
                positive,
                neutral,
                negative,
            },
            percentages: {
                positive: pct(positive),
                neutral: pct(neutral),
                negative: pct(negative),
            },
        });
    } catch (error) {
        return next(error);
    }
};

export const exportPingsAsCsv = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const organizationId = req.organizationId!;
        const { startDate, endDate, status } = req.query;

        const where: any = { organizationId };

        if (status && Object.values(Status).includes(status as Status)) {
            where.status = status as Status;
        }

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate as string);
            if (endDate) where.createdAt.lte = new Date(endDate as string);
        }

        const pings = await prisma.ping.findMany({
            where,
            include: {
                category: { select: { name: true } },
                _count: { select: { surges: true } },
                officialResponse: { select: { isResolved: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Manual CSV Generation to avoid external deps for now
        const header = 'ID,Date,Category,Title,Status,Surge Count,Days Open,Resolved\n';
        const rows = pings.map(p => {
            const date = p.createdAt.toISOString().split('T')[0];
            const category = p.category.name.replace(/,/g, ' '); // simple escape
            const title = p.title.replace(/,/g, ' ').replace(/\n/g, ' '); // simple escape
            const surgeCount = p.surgeCount;

            // Calc days open
            const end = p.resolvedAt || new Date();
            const diffTime = Math.abs(end.getTime() - p.createdAt.getTime());
            const daysOpen = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const isResolved = p.officialResponse?.isResolved || p.status === 'APPROVED'; // Loose check for example

            return `${p.id},${date},${category},${title},${p.status},${surgeCount},${daysOpen},${isResolved}`;
        }).join('\n');

        const csvContent = header + rows;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="pings_export_${new Date().toISOString().split('T')[0]}.csv"`);

        return res.status(200).send(csvContent);

    } catch (error) {
        return next(error);
    }
};
