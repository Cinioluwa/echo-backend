import { NextFunction, Response } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';

type ReportTarget = {
  pingId?: number;
  waveId?: number;
  commentId?: number;
};

const REPORT_INCLUDE = {
  reporter: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      displayName: true,
      profilePicture: true,
    },
  },
  ping: {
    select: {
      id: true,
      title: true,
      content: true,
    },
  },
  wave: {
    select: {
      id: true,
      solution: true,
      ping: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  },
  comment: {
    select: {
      id: true,
      content: true,
      pingId: true,
      waveId: true,
    },
  },
} as const;

const getReportTargetForNotification = (target: ReportTarget) => ({
  pingId: target.pingId,
  waveId: target.waveId,
  commentId: target.commentId,
});

export const createReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.organizationId;
    const reporterId = req.user?.userId;

    if (!organizationId || !reporterId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { pingId, waveId, commentId, reason } = req.body as {
      pingId?: number;
      waveId?: number;
      commentId?: number;
      reason?: string;
    };

    let target: ReportTarget = {};
    let reportTitle = 'Content reported';

    if (pingId !== undefined) {
      const ping = await prisma.ping.findFirst({
        where: { id: pingId, organizationId },
        select: { id: true, authorId: true, title: true },
      });

      if (!ping) {
        return res.status(404).json({ error: 'Ping not found' });
      }

      if (ping.authorId === reporterId) {
        return res.status(400).json({ error: 'You cannot report your own ping' });
      }

      target = { pingId: ping.id };
      reportTitle = `Ping reported: ${ping.title}`;
    }

    if (waveId !== undefined) {
      const wave = await prisma.wave.findFirst({
        where: { id: waveId, organizationId },
        select: { id: true, authorId: true },
      });

      if (!wave) {
        return res.status(404).json({ error: 'Wave not found' });
      }

      if (wave.authorId === reporterId) {
        return res.status(400).json({ error: 'You cannot report your own wave' });
      }

      target = { waveId: wave.id };
      reportTitle = `Wave reported #${wave.id}`;
    }

    if (commentId !== undefined) {
      const comment = await prisma.comment.findFirst({
        where: { id: commentId, organizationId },
        select: { id: true, authorId: true },
      });

      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      if (comment.authorId === reporterId) {
        return res.status(400).json({ error: 'You cannot report your own comment' });
      }

      target = { commentId: comment.id };
      reportTitle = `Comment reported #${comment.id}`;
    }

    const duplicatePending = await prisma.report.findFirst({
      where: {
        organizationId,
        reporterId,
        status: 'PENDING',
        pingId: target.pingId,
        waveId: target.waveId,
        commentId: target.commentId,
      },
      select: { id: true },
    });

    if (duplicatePending) {
      return res.status(409).json({ error: 'You already have a pending report for this content' });
    }

    const createdReport = await prisma.$transaction(async (tx) => {
      const created = await tx.report.create({
        data: {
          organizationId,
          reporterId,
          reason,
          ...target,
        },
        include: REPORT_INCLUDE,
      });

      const adminUsers = await tx.user.findMany({
        where: {
          organizationId,
          role: { in: ['ADMIN', 'SUPER_ADMIN'] },
          id: { not: reporterId },
        },
        select: { id: true },
      });

      if (adminUsers.length > 0) {
        await tx.notification.createMany({
          data: adminUsers.map((adminUser) => ({
            userId: adminUser.id,
            organizationId,
            type: 'POST_REPORTED',
            title: reportTitle,
            body: reason && reason.trim().length > 0 ? reason.trim() : 'A post has been reported for review.',
            ...getReportTargetForNotification(target),
          })),
        });
      }

      return created;
    });

    return res.status(201).json(createdReport);
  } catch (error) {
    return next(error);
  }
};

export const getReports = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization context missing' });
    }

    const page = Number(req.query.page) || 1;
    let limit = Number(req.query.limit) || 20;
    if (limit > 100) limit = 100;
    const skip = (page - 1) * limit;

    const status = req.query.status as 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED' | undefined;

    const where = {
      organizationId,
      ...(status ? { status } : {}),
    };

    const [data, total] = await prisma.$transaction([
      prisma.report.findMany({
        where,
        include: REPORT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.report.count({ where }),
    ]);

    return res.status(200).json({
      data,
      pagination: {
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateReportStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.organizationId;
    const actorId = req.user?.userId;
    const reportId = Number(req.params.id);
    const { status } = req.body as { status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED' };

    if (!organizationId || !actorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const existing = await prisma.report.findFirst({
      where: {
        id: reportId,
        organizationId,
      },
      select: {
        id: true,
        status: true,
        reporterId: true,
        pingId: true,
        waveId: true,
        commentId: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id: reportId },
        data: { status },
        include: REPORT_INCLUDE,
      });

      if (existing.reporterId !== actorId && existing.status !== status) {
        await tx.notification.create({
          data: {
            userId: existing.reporterId,
            organizationId,
            type: 'POST_REPORTED',
            title: 'Update on your report',
            body: `Your report is now ${status.toLowerCase()}.`,
            pingId: existing.pingId,
            waveId: existing.waveId,
            commentId: existing.commentId,
          },
        });
      }

      return report;
    });

    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
};
