import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';

export const createAnnouncement = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { title, content, targetCollege, targetHall, targetLevel, targetGender } = req.body;
        const userId = req.user?.userId;

        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        const newAnnouncement = await prisma.announcement.create({
            data: {
                title,
                content,
                authorId: userId!,
                targetCollege,
                targetHall,
                targetLevel,
                targetGender,
            },
        });

        return res.status(201).json(newAnnouncement);
    } catch (error) {
        return next(error);
    }
};

export const getAnnouncements = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { college, hall, level, gender } = req.query;

        const whereClause: any = {};
        if (college) whereClause.targetCollege = {has: college as string};
        if (hall) whereClause.targetHall = {has: hall as string};
        if (level) whereClause.targetLevel = {has: parseInt(level as string)};
        if (gender ) whereClause.targetGender = {has: gender as string};

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
        const { title, content, targetCollege, targetHall, targetLevel, targetGender } = req.body;

        const updatedAnnouncement = await prisma.announcement.update({
            where: { id: parseInt(id) },
            data: {
                title,
                content,
                targetCollege,
                targetHall,
                targetLevel,
                targetGender,
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
            where: { id: parseInt(id) },
        });
        return res.status(204).send();
    }
    catch (error) {
        return next(error);
    }
};


