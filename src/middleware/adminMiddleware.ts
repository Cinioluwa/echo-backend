import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/AuthRequest.js';
import prisma from '../config/db.js';

const adminMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (user && user.role === 'ADMIN') {
            next();
        } else {
            return res.status(403).json({ error: 'Forbidden: Admins only' });
        }
    } catch (error) {
        return next(error as any);
    }
};

export default adminMiddleware;


