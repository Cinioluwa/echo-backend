import type { Request, Response, NextFunction } from 'express';
import prisma from '../config/db.js';

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
