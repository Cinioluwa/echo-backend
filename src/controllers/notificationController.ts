import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';
import { computeNotificationUrl } from '../services/notificationService.js';

export const listNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.organizationId!;
    const userId = req.user!.userId;

    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    if (limit > 100) limit = 100;
    const skip = (page - 1) * limit;

    const unreadOnly = req.query.unreadOnly === 'true';

    const where: any = { organizationId, userId };
    if (unreadOnly) where.readAt = null;

    const [rows, total] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const data = rows.map(row => ({
      ...row,
      url: computeNotificationUrl(row)
    }));

    return res.status(200).json({
      data,
      pagination: {
        total,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getUnreadNotificationCount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.organizationId!;
    const userId = req.user!.userId;

    const unreadCount = await prisma.notification.count({
      where: { organizationId, userId, readAt: null },
    });

    return res.status(200).json({ unreadCount });
  } catch (error) {
    return next(error);
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.organizationId!;
    const userId = req.user!.userId;
    const notificationId = parseInt(req.params.id);

    const existing = await prisma.notification.findFirst({
      where: { id: notificationId, organizationId, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: existing.readAt ?? new Date() },
    });

    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.organizationId!;
    const userId = req.user!.userId;

    const result = await prisma.notification.updateMany({
      where: { organizationId, userId, readAt: null },
      data: { readAt: new Date() },
    });

    return res.status(200).json({ 
      message: 'All notifications marked as read',
      count: result.count 
    });
  } catch (error) {
    return next(error);
  }
};
