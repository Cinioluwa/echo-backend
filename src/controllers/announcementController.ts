import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';
import { createAnnouncementNotificationsForOrg } from '../services/notificationService.js';

export const createAnnouncement = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { title, content, categoryIds } = req.body;
        const userId = req.user!.userId; // Non-null assertion since middleware validates this
        const organizationId = req.organizationId!;

        const newAnnouncement = await prisma.$transaction(async (tx) => {
            const created = await tx.announcement.create({
                data: {
                    title,
                    content,
                    authorId: userId,
                    organizationId,
                    categories: {
                        connect: categoryIds?.map((id: number) => ({ id })) || [],
                    },
                },
                include: {
                    categories: true,
                    author: {
                        select: {
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            });

            await createAnnouncementNotificationsForOrg(tx as any, {
                organizationId,
                announcementId: created.id,
                title: 'New announcement',
                body: created.title,
                excludeUserId: userId,
            });

            return created;
        });

        return res.status(201).json(newAnnouncement);
    } catch (error) {
        return next(error);
    }
};

export const getAnnouncements = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { categoryId } = req.query;

        const whereClause: any = {
            organizationId: req.organizationId!,
        };

        // Filter by specific category if provided
        if (categoryId) {
            whereClause.categories = {
                some: {
                    id: parseInt(categoryId as string),
                },
            };
        }

        const announcements = await prisma.announcement.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            include: {
                author: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
                categories: true,
            },
            });
            return res.status(200).json(announcements);
        } catch (error) {
            return next(error);
        }   
};

export const updateAnnouncement = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { title, content, categoryIds } = req.body;

        const updatedAnnouncement = await prisma.announcement.update({
            where: { 
                id: parseInt(id),
                organizationId: req.organizationId!, // Ensure it belongs to the user's org
            },
            data: {
                title,
                content,
                categories: {
                    set: categoryIds?.map((id: number) => ({ id })) || [],
                },
            },
            include: {
                categories: true,
                author: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        return res.status(200).json(updatedAnnouncement);
    }
    catch (error) {
        return next(error);
    }
};

export const deleteAnnouncement = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        await prisma.announcement.delete({
            where: { 
                id: parseInt(id),
                organizationId: req.organizationId!, // Ensure it belongs to the user's org
            },
        });
        return res.status(204).send();
    }
    catch (error) {
        return next(error);
    }
};


