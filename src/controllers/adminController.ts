import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { ProgressStatus } from '@prisma/client';

export const getPlatformStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [totalUsers, totalPings, totalSurges, totalWaves, totalComments] = await prisma.$transaction([
            prisma.user.count(),
            prisma.ping.count(),
            prisma.surge.count(),
            prisma.wave.count(),
            prisma.comment.count()
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

export const deleteAnyPing = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const pingId = parseInt(id);

        const ping = await prisma.ping.findUnique({
            where: { id: pingId }
        });

        if (!ping) {
            return res.status(404).json({ error: 'Ping not found' });
        }

        await prisma.ping.delete({
            where: { id: pingId }
        });

        return res.status(204).send();
    } catch (error) {
        return next(error);
    }
};

export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await prisma.user.findMany({
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

export const updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!['USER', 'ADMIN', 'REPRESENTATIVE'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role specified' });
        }

        const updatedUser = await prisma.user.update({
            where: { id: parseInt(id) },
            data: { role }
        });

        const { password: _pw, ...safeUser } = updatedUser;
        return res.status(200).json(safeUser);
    } catch (error) {
        return next(error);
    }
};

export const getPingsByLevel = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const pings = await prisma.ping.findMany({
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


export const getPingStatsByCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await prisma.ping.groupBy({
      by: ['category'],
      _count: {
        id: true, 
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    const formattedStats = stats.map(item => ({
      name: item.category,
      count: item._count.id,
    }));

    return res.status(200).json(formattedStats);
  } catch (error) {
    return next(error);
  }
};

export const getUserByIdAsAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const userId = parseInt(id);
        const user = await prisma.user.findUnique({
            where: { id: userId },
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

export const updatePingProgressStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { status } = req.body as { status: ProgressStatus };

        if (!Object.values(ProgressStatus).includes(status)) {
            return res.status(400).json({ error: 'Invalid progress status' });
        }

        const updated = await prisma.ping.update({
            where: { id: parseInt(id) },
            data: { progressStatus: status, progressUpdatedAt: new Date() },
            select: { id: true, title: true, progressStatus: true, progressUpdatedAt: true },
        });

        return res.status(200).json(updated);
    } catch (error) {
        return next(error);
    }
};
