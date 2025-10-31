import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';
import logger from '../config/logger.js';

export const createOfficialResponse = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { pingId } = req.params;
        const { content } = req.body;
        const userId = req.user?.userId;
        const organizationId = req.user?.organizationId;

        if (!userId || !organizationId) {
            return res.status(401).json({ message: 'Unauthorized: User or organization context missing' });
        }

        const ping = await prisma.ping.findFirst({
            where: {
                id: parseInt(pingId),
                organizationId: organizationId,
            },
        });
        if (!ping) {
            return res.status(404).json({ message: 'Ping not found in your organization' });
        }

        const newResponse = await prisma.officialResponse.create({
            data: {
                content,
                authorId: userId,
                pingId: parseInt(pingId),
                organizationId,
            },
        });
        return res.status(201).json(newResponse);
    } catch (error) {
        // Remove direct handling of P2002, let errorHandler middleware handle it
        logger.error('Error creating official response:', error);
        return next(error);
    }
};