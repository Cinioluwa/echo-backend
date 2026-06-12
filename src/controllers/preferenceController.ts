import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import logger from '../config/logger.js';
import { verifyUnsubscribeToken } from '../services/tokenService.js';

export const unsubscribeFromMarketing = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { token } = req.query;

        if (!token || typeof token !== 'string') {
            return res.status(400).send('Invalid unsubscribe token');
        }

        const userId = verifyUnsubscribeToken(token);

        if (!userId) {
            return res.status(400).send('Invalid or expired unsubscribe token');
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Upsert notification preference to ensure it exists and disable marketing emails
        await prisma.notificationPreference.upsert({
            where: { userId },
            update: { marketingEmailEnabled: false },
            create: { userId, marketingEmailEnabled: false }
        });

        return res.status(200).send(`
            <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h2>Unsubscribed Successfully</h2>
                    <p>You have been unsubscribed from weekly digests and marketing emails.</p>
                </body>
            </html>
        `);
    } catch (error) {
        logger.error('Error unsubscribing', { error });
        return next(error);
    }
};
