import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';
import logger from '../config/logger.js';

export const createOfficialResponse = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { pingId } = req.params;
        const { content, isResolved } = req.body;
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

        const now = new Date();

        const newResponse = await prisma.$transaction(async (tx) => {
            const created = await tx.officialResponse.create({
                data: {
                    content,
                    isResolved: isResolved || false,
                    authorId: userId,
                    pingId: parseInt(pingId),
                    organizationId,
                },
            });

            // First official response counts as an institutional acknowledgment.
            await tx.ping.updateMany({
                where: {
                    id: parseInt(pingId),
                    organizationId,
                    acknowledgedAt: null,
                },
                data: { acknowledgedAt: now },
            });

            // If the response resolves the issue, set resolvedAt.
            if (isResolved) {
                await tx.ping.updateMany({
                    where: {
                        id: parseInt(pingId),
                        organizationId,
                        resolvedAt: null,
                    },
                    data: { resolvedAt: now },
                });
            }

            return created;
        });

        return res.status(201).json(newResponse);
    } catch (error) {
        // Remove direct handling of P2002, let errorHandler middleware handle it
        logger.error('Error creating official response:', error);
        return next(error);
    }
};

export const updateOfficialResponse = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { pingId } = req.params;
        const { content, isResolved } = req.body;
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

        const existingResponse = await prisma.officialResponse.findUnique({
            where: { pingId: parseInt(pingId) },
        });

        if (!existingResponse) {
            return res.status(404).json({ message: 'Official response not found' });
        }

        const now = new Date();
        const updatedResponse = await prisma.$transaction(async (tx) => {
            const updated = await tx.officialResponse.update({
                where: { pingId: parseInt(pingId) },
                data: {
                    content: content !== undefined ? content : undefined,
                    isResolved: isResolved !== undefined ? isResolved : undefined,
                },
            });

            // Ensure acknowledgedAt exists once there is an official response
            await tx.ping.updateMany({
                where: {
                    id: parseInt(pingId),
                    organizationId,
                    acknowledgedAt: null,
                },
                data: { acknowledgedAt: now },
            });

            // If it gets marked resolved, set resolvedAt if not already set
            if (isResolved === true) {
                await tx.ping.updateMany({
                    where: {
                        id: parseInt(pingId),
                        organizationId,
                        resolvedAt: null,
                    },
                    data: { resolvedAt: now },
                });
            }

            return updated;
        });

        return res.status(200).json(updatedResponse);
    } catch (error) {
        logger.error('Error updating official response:', error);
        return next(error);
    }
};