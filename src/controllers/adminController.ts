import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { ProgressStatus } from '@prisma/client';
import { AuthRequest } from '../types/AuthRequest.js';

export const getPlatformStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const [totalUsers, totalPings, totalSurges, totalWaves, totalComments] = await prisma.$transaction([
            prisma.user.count({ where: { organizationId: req.organizationId! } }),
            prisma.ping.count({ where: { organizationId: req.organizationId! } }),
            prisma.surge.count({ where: { organizationId: req.organizationId! } }),
            prisma.wave.count({ where: { organizationId: req.organizationId! } }),
            prisma.comment.count({ where: { organizationId: req.organizationId! } }),
        ]);

        const stats = {
            totalUsers,
            totalPings,
            totalSurges,
            totalWaves,
            totalComments
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
