import webpush from 'web-push';
import prisma from '../config/db.js';
import { env } from '../config/env.js';
import logger from '../config/logger.js';

// Initialize web-push if keys are available
if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        env.VAPID_SUBJECT || 'mailto:support@echo.com',
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY
    );
} else {
    logger.warn('VAPID keys not found. Web push notifications will be disabled.');
}

export type WebPushPayload = {
    title: string;
    body: string;
    url?: string;
    icon?: string;
};

export const sendPushNotification = async (userId: number, payload: WebPushPayload) => {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
        return;
    }

    try {
        const subscriptions = await prisma.pushSubscription.findMany({
            where: { userId },
        });

        if (subscriptions.length === 0) {
            return;
        }

        const pushPayload = JSON.stringify({
            title: payload.title,
            body: payload.body,
            url: payload.url || '/',
            icon: payload.icon || '/icon.png',
        });

        const sendPromises = subscriptions.map(async (sub) => {
            try {
                await webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.p256dh,
                            auth: sub.auth,
                        },
                    },
                    pushPayload
                );
            } catch (err: any) {
                // If subscription is gone or invalid (410 or 404), remove it from DB
                if (err.statusCode === 404 || err.statusCode === 410) {
                    await prisma.pushSubscription.delete({
                        where: { id: sub.id },
                    });
                } else {
                    logger.error(`Failed to send push notification to subscription ${sub.id}`, err);
                }
            }
        });

        await Promise.allSettled(sendPromises);
    } catch (error) {
        logger.error('Error sending push notifications:', error);
    }
};
