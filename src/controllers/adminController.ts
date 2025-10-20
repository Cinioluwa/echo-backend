import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db.js';

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
        next(error);
    }
};