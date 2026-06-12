import prisma from '../config/db.js';
import logger from '../config/logger.js';
import { sendEmail, buildWeeklyDigestEmail } from './emailService.js';
import { generateUnsubscribeToken } from './tokenService.js';

const DAYS_IN_MS = 24 * 60 * 60 * 1000;

export const sendWeeklyDigest = async () => {
    logger.info('Starting weekly digest job...');
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * DAYS_IN_MS);

    // 1. Fetch all active organizations
    const organizations = await prisma.organization.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true }
    });

    for (const org of organizations) {
        try {
            // 2. Calculate weekly stats
            const newPingsCount = await prisma.ping.count({
                where: { organizationId: org.id, createdAt: { gte: oneWeekAgo } }
            });

            // If no new pings, skip sending digest for this org to avoid spamming
            if (newPingsCount === 0) continue;

            const newWavesCount = await prisma.wave.count({
                where: { organizationId: org.id, createdAt: { gte: oneWeekAgo } }
            });

            const newCommentsCount = await prisma.comment.count({
                where: { organizationId: org.id, createdAt: { gte: oneWeekAgo } }
            });

            const newSurgesCount = await prisma.surge.count({
                where: { organizationId: org.id, createdAt: { gte: oneWeekAgo } }
            });

            // Calculate active users (unique users who created a ping, comment, wave, or surge)
            const [pingAuthors, commentAuthors, waveAuthors, surgeUsers] = await Promise.all([
                prisma.ping.findMany({ where: { organizationId: org.id, createdAt: { gte: oneWeekAgo } }, select: { authorId: true }, distinct: ['authorId'] }),
                prisma.comment.findMany({ where: { organizationId: org.id, createdAt: { gte: oneWeekAgo } }, select: { authorId: true }, distinct: ['authorId'] }),
                prisma.wave.findMany({ where: { organizationId: org.id, createdAt: { gte: oneWeekAgo } }, select: { authorId: true }, distinct: ['authorId'] }),
                prisma.surge.findMany({ where: { organizationId: org.id, createdAt: { gte: oneWeekAgo } }, select: { userId: true }, distinct: ['userId'] }),
            ]);

            const activeUserIds = new Set<number>();
            for (const row of pingAuthors) activeUserIds.add(row.authorId);
            for (const row of commentAuthors) activeUserIds.add(row.authorId);
            for (const row of waveAuthors) activeUserIds.add(row.authorId);
            for (const row of surgeUsers) activeUserIds.add(row.userId);

            const activeUsersCount = activeUserIds.size;

            // Get top 3 pings by surges this week
            const topSurgedThisWeek = await prisma.surge.groupBy({
                by: ['pingId'],
                where: { organizationId: org.id, createdAt: { gte: oneWeekAgo }, pingId: { not: null } },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 3,
            });

            const topPingsData = [];
            for (const top of topSurgedThisWeek) {
                if (top.pingId) {
                    const ping = await prisma.ping.findUnique({
                        where: { id: top.pingId },
                        select: { id: true, title: true, surgeCount: true } // We use total surgeCount for display
                    });
                    if (ping) topPingsData.push(ping);
                }
            }

            if (topPingsData.length === 0) continue; // Skip if no top pings found

            const stats = {
                topPings: topPingsData,
                newPingsCount,
                activeUsersCount
            };

            // 3. Fetch users who have opted in
            const usersToEmail = await prisma.user.findMany({
                where: {
                    organizationId: org.id,
                    notificationPreference: {
                        marketingEmailEnabled: true
                    }
                },
                select: { id: true, email: true }
            });

            logger.info(`Sending digest to ${usersToEmail.length} users in org ${org.name}`);

            // 4. Send emails
            for (const user of usersToEmail) {
                const token = generateUnsubscribeToken(user.id);
                const { subject, html, text } = buildWeeklyDigestEmail(stats, token);
                
                await sendEmail({
                    to: user.email,
                    subject,
                    html,
                    text
                });
            }

        } catch (error) {
            logger.error(`Failed to send digest for org ${org.name}`, { error });
        }
    }
    logger.info('Weekly digest job completed.');
};
