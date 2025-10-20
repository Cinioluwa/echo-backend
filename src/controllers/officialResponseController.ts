import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';
import logger from '../config/logger.js';

export const createOfficialResponse = async (req: AuthRequest, res: Response) => {
    try {
        const { pingId } = req.params;
        const { content } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: User ID not found' });
        }

        if (!content || content.trim() === '') {
            return res.status(400).json({ message: 'Content is required' });
        }

        const newResponse = await prisma.officialResponse.create({
            data: {
                content,
                authorId: userId,
                pingId: parseInt(pingId),
    },
        });
        return res.status(201).json(newResponse);
    } catch (error) {
        if(error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            return res.status(409).json({ message: 'An official response for this ping already exists' });
        }
        logger.error('Error creating official response:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};