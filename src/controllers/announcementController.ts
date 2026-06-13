import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';
import { createAnnouncementNotificationsForOrg } from '../services/notificationService.js';
import { invalidateCacheAfterMutation } from '../utils/cacheInvalidation.js';
import { emitAnnouncement } from '../utils/socketEmitter.js';

export const createAnnouncement = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { title, content } = req.body;
        const userId = req.user!.userId; // Non-null assertion since middleware validates this
        const organizationId = req.organizationId!;

        const newAnnouncement = await prisma.$transaction(async (tx) => {
            const created = await tx.announcement.create({
                data: {
                    title,
                    content,
                    authorId: userId,
                    organizationId,
                },
                include: {
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

        // Trigger email blast in the background
        setImmediate(async () => {
            try {
                // Import dynamically to avoid circular dependencies if any
                const { sendEmail, buildAnnouncementEmail } = await import('../services/emailService.js');
                const { generateUnsubscribeToken } = await import('../services/tokenService.js');
                
                // Fetch users in the org who have marketing emails enabled
                const usersToEmail = await prisma.user.findMany({
                    where: {
                        organizationId,
                        notificationPreference: {
                            marketingEmailEnabled: true
                        }
                    },
                    select: { id: true, email: true }
                });

                // Fetch organization name
                const org = await prisma.organization.findUnique({
                    where: { id: organizationId },
                    select: { name: true }
                });

                if (!org) return;

                const authorName = newAnnouncement.author.firstName 
                    ? `${newAnnouncement.author.firstName} ${newAnnouncement.author.lastName}`.trim()
                    : 'A representative';

                for (const user of usersToEmail) {
                    const token = generateUnsubscribeToken(user.id);
                    const { subject, html, text } = buildAnnouncementEmail(
                        org.name,
                        newAnnouncement.title,
                        newAnnouncement.content,
                        authorName,
                        token
                    );

                    await sendEmail({
                        to: user.email,
                        subject,
                        html,
                        text
                    });
                }
            } catch (error) {
                console.error('Failed to send announcement emails in background:', error);
            }
        });

        // Invalidate cache after creating announcement
        await invalidateCacheAfterMutation(organizationId);

        // Emit real-time announcement event
        emitAnnouncement(organizationId, newAnnouncement);

        return res.status(201).json(newAnnouncement);
    } catch (error) {
        return next(error);
    }
};

export const getAnnouncements = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const whereClause: any = {
            organizationId: req.organizationId!,
        };

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
        const { title, content } = req.body;

        const updatedAnnouncement = await prisma.announcement.update({
            where: { 
                id: parseInt(id),
                organizationId: req.organizationId!, // Ensure it belongs to the user's org
            },
            data: {
                title,
                content,
            },
            include: {
                author: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        // Invalidate cache after update
        await invalidateCacheAfterMutation(req.organizationId);

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

        // Invalidate cache after deletion
        await invalidateCacheAfterMutation(req.organizationId);

        return res.status(204).send();
    }
    catch (error) {
        return next(error);
    }
};


