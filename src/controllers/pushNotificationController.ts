import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/AuthRequest.js';
import prisma from '../config/db.js';
import { env } from '../config/env.js';

export const subscribe = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const { endpoint, keys } = req.body;

        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return res.status(400).json({ error: 'Invalid push subscription object' });
        }

        const subscription = await prisma.pushSubscription.upsert({
            where: { endpoint },
            update: {
                userId,
                p256dh: keys.p256dh,
                auth: keys.auth,
            },
            create: {
                userId,
                endpoint,
                p256dh: keys.p256dh,
                auth: keys.auth,
            },
        });

        return res.status(200).json(subscription);
    } catch (error) {
        return next(error);
    }
};

export const unsubscribe = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({ error: 'Endpoint is required' });
        }

        await prisma.pushSubscription.deleteMany({
            where: {
                userId,
                endpoint,
            },
        });

        return res.status(200).json({ message: 'Unsubscribed successfully' });
    } catch (error) {
        return next(error);
    }
};

export const getVapidPublicKey = (req: AuthRequest, res: Response) => {
    return res.status(200).json({ publicKey: env.VAPID_PUBLIC_KEY || '' });
};
