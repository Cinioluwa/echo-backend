import type { NextFunction, Response } from 'express';
import prisma from '../config/db.js';
import type { AuthRequest } from '../types/AuthRequest.js';
import {
  ensurePendingOrganizationJoinRequest,
  getEffectiveJoinPolicy,
  isJoinPolicyLocked,
} from '../services/organizationJoinPolicyService.js';
import logger from '../config/logger.js';
import { sendEmail, buildJoinRequestApprovedEmail, buildJoinRequestRejectedEmail } from '../services/emailService.js';

export async function getOrganizationJoinSettings(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const organizationId = req.organizationId!;

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        domain: true,
        status: true,
        joinPolicy: true,
        isDomainLocked: true,
      },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    return res.status(200).json({
      organization: {
        ...organization,
        effectiveJoinPolicy: getEffectiveJoinPolicy(organization),
        joinPolicyLocked: isJoinPolicyLocked(organization),
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateOrganizationJoinPolicy(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const organizationId = req.organizationId!;
    const { joinPolicy } = req.body;

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        domain: true,
        joinPolicy: true,
        isDomainLocked: true,
      },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (isJoinPolicyLocked(organization) && joinPolicy !== 'REQUIRES_APPROVAL') {
      return res.status(400).json({
        error: 'Open-domain organizations are permanently locked to REQUIRES_APPROVAL.',
        code: 'JOIN_POLICY_LOCKED',
      });
    }

    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        joinPolicy,
        isDomainLocked: !organization.domain ? true : organization.isDomainLocked,
      },
      select: {
        id: true,
        name: true,
        domain: true,
        status: true,
        joinPolicy: true,
        isDomainLocked: true,
      },
    });

    return res.status(200).json({
      message: 'Organization join policy updated successfully.',
      organization: {
        ...updated,
        effectiveJoinPolicy: getEffectiveJoinPolicy(updated),
        joinPolicyLocked: isJoinPolicyLocked(updated),
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function listOrganizationJoinRequests(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const organizationId = req.organizationId!;
    const status = typeof req.query.status === 'string' ? req.query.status : 'PENDING';

    const requests = await prisma.organizationJoinRequest.findMany({
      where: {
        organizationId,
        ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isVerified: true,
            status: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return res.status(200).json({ requests });
  } catch (error) {
    return next(error);
  }
}

export async function approveOrganizationJoinRequest(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const organizationId = req.organizationId!;
    const reviewerId = req.user!.userId;
    const joinRequestId = Number(req.params.id);

    if (Number.isNaN(joinRequestId)) {
      return res.status(400).json({ error: 'Invalid join request id' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.organizationJoinRequest.findFirst({
        where: {
          id: joinRequestId,
          organizationId,
          status: 'PENDING',
        },
        include: {
          user: {
            select: {
              id: true,
              isVerified: true,
            },
          },
        },
      });

      if (!request) {
        return null;
      }

      await tx.organizationJoinRequest.update({
        where: { id: joinRequestId },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedById: reviewerId,
        },
      });

      await tx.user.update({
        where: { id: request.user.id },
        data: {
          status: request.user.isVerified ? 'ACTIVE' : 'PENDING',
        },
      });

      return request;
    });

    if (!result) {
      return res.status(404).json({ error: 'Pending organization join request not found' });
    }

    try {
      const approvedUser = await prisma.user.findUnique({
        where: { id: result.user.id },
        select: { email: true, organization: { select: { name: true } } },
      });
      if (approvedUser) {
        const emailContent = buildJoinRequestApprovedEmail(approvedUser.organization?.name ?? 'your organization');
        await sendEmail({ to: approvedUser.email, ...emailContent });
      }
    } catch (emailError) {
      logger.error('Failed to send join request approval email', {
        userId: result.user.id,
        message: (emailError as Error).message,
      });
    }

    return res.status(200).json({
      message: 'Organization join request approved.',
      requestId: joinRequestId,
      userId: result.user.id,
    });
  } catch (error) {
    return next(error);
  }
}

export async function rejectOrganizationJoinRequest(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const organizationId = req.organizationId!;
    const reviewerId = req.user!.userId;
    const joinRequestId = Number(req.params.id);
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : undefined;

    if (Number.isNaN(joinRequestId)) {
      return res.status(400).json({ error: 'Invalid join request id' });
    }

    const updated = await prisma.organizationJoinRequest.updateMany({
      where: {
        id: joinRequestId,
        organizationId,
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        reason: reason || null,
        reviewedAt: new Date(),
        reviewedById: reviewerId,
      },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: 'Pending organization join request not found' });
    }

    try {
      const joinRequest = await prisma.organizationJoinRequest.findUnique({
        where: { id: joinRequestId },
        select: {
          email: true,
          reason: true,
          organization: { select: { name: true } },
        },
      });
      if (joinRequest) {
        const emailContent = buildJoinRequestRejectedEmail(
          joinRequest.organization?.name ?? 'the organization',
          joinRequest.reason ?? undefined,
        );
        await sendEmail({ to: joinRequest.email, ...emailContent });
      }
    } catch (emailError) {
      logger.error('Failed to send join request rejection email', {
        joinRequestId,
        message: (emailError as Error).message,
      });
    }

    return res.status(200).json({
      message: 'Organization join request rejected.',
      requestId: joinRequestId,
    });
  } catch (error) {
    return next(error);
  }
}

export async function queueJoinApprovalForUser(
  userId: number,
  organizationId: number,
  email: string
) {
  return ensurePendingOrganizationJoinRequest(prisma, {
    userId,
    organizationId,
    email,
  });
}
