import type { Request, Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import type { AuthRequest } from '../types/AuthRequest.js';
import { ensureOrganizationDefaultCategories } from '../services/organizationCategoryService.js';

export async function listOrganizationRequests(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const requests = await prisma.organizationRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        organization: true,
      },
    });

    return res.status(200).json({ requests });
  } catch (error) {
    return next(error);
  }
}

export async function approveOrganizationRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const orgRequest = await tx.organizationRequest.findUnique({
        where: { id },
      });

      if (!orgRequest) {
        return null;
      }

      const updatedRequest = await tx.organizationRequest.update({
        where: { id },
        data: { status: 'APPROVED', resolvedAt: new Date() },
      });

      if (orgRequest.organizationId) {
        await tx.organization.update({
          where: { id: orgRequest.organizationId },
          data: { status: 'ACTIVE' },
        });
      }

      return updatedRequest;
    });

    if (!result) {
      return res.status(404).json({ error: 'Organization request not found' });
    }

    return res.status(200).json({
      message: 'Organization request approved',
      request: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function rejectOrganizationRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const orgRequest = await prisma.organizationRequest.findUnique({ where: { id } });
    if (!orgRequest) {
      return res.status(404).json({ error: 'Organization request not found' });
    }

    const updated = await prisma.organizationRequest.update({
      where: { id },
      data: { status: 'REJECTED', resolvedAt: new Date() },
    });

    return res.status(200).json({
      message: 'Organization request rejected',
      request: updated,
    });
  } catch (error) {
    return next(error);
  }
}

export async function listOrganizationClaims(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const statusFilter =
      status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED'
        ? status
        : undefined;

    const claims = await prisma.organizationClaim.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        organization: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isVerified: true,
            status: true,
            role: true,
          },
        },
      },
    });

    return res.status(200).json({ claims });
  } catch (error) {
    return next(error);
  }
}

export async function approveOrganizationClaim(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid claim id' });
    }

    const reviewerId = req.user?.userId;
    if (!reviewerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const claim = await tx.organizationClaim.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              isVerified: true,
            },
          },
          organization: {
            select: {
              id: true,
              isClaimVerified: true,
            },
          },
        },
      });

      if (!claim) {
        return { kind: 'not_found' as const };
      }

      if (claim.status !== 'PENDING') {
        return { kind: 'invalid_state' as const };
      }

      if (claim.organization.isClaimVerified) {
        return { kind: 'already_claimed' as const };
      }

      if (!claim.user.isVerified) {
        return { kind: 'email_not_verified' as const };
      }

      const approvedClaim = await tx.organizationClaim.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedById: reviewerId,
        },
      });

      await tx.organization.update({
        where: { id: claim.organizationId },
        data: {
          status: 'ACTIVE',
          isClaimVerified: true,
          categoryCustomizationLocked: false,
        },
      });

      await tx.user.update({
        where: { id: claim.userId },
        data: {
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      await ensureOrganizationDefaultCategories(tx, claim.organizationId);

      await tx.organizationClaim.updateMany({
        where: {
          organizationId: claim.organizationId,
          status: 'PENDING',
          id: { not: id },
        },
        data: {
          status: 'REJECTED',
          reason: 'Leadership claim already approved for this organization.',
          reviewedAt: new Date(),
          reviewedById: reviewerId,
        },
      });

      return { kind: 'approved' as const, claim: approvedClaim };
    });

    if (result.kind === 'not_found') {
      return res.status(404).json({ error: 'Organization claim not found' });
    }

    if (result.kind === 'invalid_state') {
      return res.status(409).json({
        error: 'Only pending claims can be approved.',
        code: 'ORG_CLAIM_NOT_PENDING',
      });
    }

    if (result.kind === 'already_claimed') {
      return res.status(409).json({
        error: 'Organization leadership is already verified.',
        code: 'ORG_ALREADY_CLAIMED',
      });
    }

    if (result.kind === 'email_not_verified') {
      return res.status(400).json({
        error: 'Claimant email must be verified before approval.',
        code: 'ORG_CLAIM_EMAIL_NOT_VERIFIED',
      });
    }

    return res.status(200).json({
      message: 'Organization claim approved',
      claim: result.claim,
    });
  } catch (error) {
    return next(error);
  }
}

export async function rejectOrganizationClaim(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid claim id' });
    }

    const reviewerId = req.user?.userId;
    if (!reviewerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : undefined;

    const claim = await prisma.organizationClaim.findUnique({ where: { id } });
    if (!claim) {
      return res.status(404).json({ error: 'Organization claim not found' });
    }

    if (claim.status !== 'PENDING') {
      return res.status(409).json({
        error: 'Only pending claims can be rejected.',
        code: 'ORG_CLAIM_NOT_PENDING',
      });
    }

    const updated = await prisma.organizationClaim.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reason,
        reviewedAt: new Date(),
        reviewedById: reviewerId,
      },
    });

    return res.status(200).json({
      message: 'Organization claim rejected',
      claim: updated,
    });
  } catch (error) {
    return next(error);
  }
}
