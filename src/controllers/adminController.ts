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
