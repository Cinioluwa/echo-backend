import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/AuthRequest.js';
import prisma from '../config/db.js';
import logger from '../config/logger.js';

const representativeMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: User ID not found' });
        }  

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (user && (user.role === 'REPRESENTATIVE' || user.role === 'ADMIN')) {
            next();
        } else {
            return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
        }
    } catch (error) {
        logger.error('Error in representativeMiddleware:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

export default representativeMiddleware;
