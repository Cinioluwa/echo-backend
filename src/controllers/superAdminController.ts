// src/controllers/superAdminController.ts
import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';

// ---------------------------------------------------------------------------
// GET /api/super-admin/stats
// Platform-wide aggregated counts — no org scoping.
// ---------------------------------------------------------------------------
export const getPlatformWideStats = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const [
      totalOrgs,
      activeOrgs,
      pendingOrgs,
      totalUsers,
      activeUsers,
      pendingUsers,
      totalPings,
      totalWaves,
      totalSurges,
      pendingOrgRequests,
      pendingClaims,
    ] = await prisma.$transaction([
      prisma.organization.count(),
      prisma.organization.count({ where: { status: 'ACTIVE' } }),
      prisma.organization.count({ where: { status: 'PENDING' } }),
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'PENDING' } }),
      prisma.ping.count(),
      prisma.wave.count(),
      prisma.surge.count(),
      prisma.organizationRequest.count({ where: { status: 'PENDING' } }),
      prisma.organizationClaim.count({ where: { status: 'PENDING' } }),
    ]);

    return res.json({
      organizations: { total: totalOrgs, active: activeOrgs, pending: pendingOrgs },
      users: { total: totalUsers, active: activeUsers, pending: pendingUsers },
      content: { pings: totalPings, waves: totalWaves, surges: totalSurges },
      queue: { pendingOrgRequests, pendingClaims },
    });
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /api/super-admin/organizations
// All organizations with user/ping counts.
// Query: ?status=ACTIVE|PENDING, ?page=1, ?limit=50
// ---------------------------------------------------------------------------
export const listAllOrganizations = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status as string | undefined;

    const where = statusFilter ? { status: statusFilter } : undefined;

    const [orgs, total] = await prisma.$transaction([
      prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          domain: true,
          status: true,
          isClaimVerified: true,
          categoryCustomizationLocked: true,
          joinPolicy: true,
          isDomainLocked: true,
          createdAt: true,
          _count: {
            select: { users: true, pings: true },
          },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    const organizations = orgs.map(({ _count, ...org }) => ({
      ...org,
      userCount: _count.users,
      pingCount: _count.pings,
    }));

    return res.json({ organizations, total, page, limit });
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/super-admin/organizations/:id/status
// Activate or deactivate (soft-lock) an organization.
// Body: { status: "ACTIVE" | "PENDING" }
// ---------------------------------------------------------------------------
export const updateOrganizationStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orgId = parseInt(req.params.id, 10);
    const { status } = req.body as { status: 'ACTIVE' | 'PENDING' };

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: { status },
      select: { id: true, name: true, domain: true, status: true },
    });

    return res.json({ organization: updated });
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /api/super-admin/users
// All users across all organizations.
// Query: ?orgId=, ?role=, ?status=, ?search= (email), ?page=, ?limit=
// ---------------------------------------------------------------------------
export const listAllUsers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const skip = (page - 1) * limit;

    const { orgId, role, status, search } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = {};
    if (orgId) where.organizationId = parseInt(orgId, 10);
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) where.email = { contains: search, mode: 'insensitive' };

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          isVerified: true,
          createdAt: true,
          organization: {
            select: { id: true, name: true, domain: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return res.json({ users, total, page, limit });
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/super-admin/users/:id/status
// Activate or deactivate (ban) a user.
// Body: { status: "ACTIVE" | "PENDING" }
// Note: SUPER_ADMIN accounts cannot be deactivated via this endpoint.
// ---------------------------------------------------------------------------
export const updateUserStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { status } = req.body as { status: 'ACTIVE' | 'PENDING' };

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true },
    });

    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (target.role === 'SUPER_ADMIN' && status === 'PENDING') {
      return res.status(400).json({ error: 'Cannot deactivate a SUPER_ADMIN account' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, email: true, role: true, status: true },
    });

    return res.json({ user: updated });
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/super-admin/maintenance/cleanup-stale-requests
// Auto-reject PENDING OrganizationRequests older than N days.
// Body: { dryRun?: boolean, olderThanDays?: number }
// ---------------------------------------------------------------------------
export const cleanupStaleRequests = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const dryRun: boolean = req.body.dryRun ?? false;
    const olderThanDays: number = req.body.olderThanDays ?? 30;

    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const stale = await prisma.organizationRequest.findMany({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
      select: {
        id: true,
        domain: true,
        organizationName: true,
        requesterEmail: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!stale.length || dryRun) {
      return res.json({
        affected: stale.length,
        dryRun,
        requests: stale.map(({ metadata: _m, ...r }) => r),
      });
    }

    const now = new Date();

    await prisma.$transaction(
      stale.map((row) => {
        const existingMetadata =
          row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : {};

        return prisma.organizationRequest.update({
          where: { id: row.id },
          data: {
            status: 'REJECTED',
            resolvedAt: now,
            metadata: {
              ...existingMetadata,
              autoRejected: true,
              autoRejectedAt: now.toISOString(),
              autoRejectedReason: `Stale pending request older than ${olderThanDays} day(s)`,
            },
          },
        });
      }),
    );

    return res.json({
      affected: stale.length,
      dryRun,
      requests: stale.map(({ metadata: _m, ...r }) => r),
    });
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/super-admin/organizations/:id
// Edit organization details: name, domain, joinPolicy.
// Changing domain may affect who can self-register; changing name must be unique.
// ---------------------------------------------------------------------------
export const updateOrganizationDetails = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orgId = parseInt(req.params.id, 10);
    const { name, domain, joinPolicy } = req.body as {
      name?: string;
      domain?: string | null;
      joinPolicy?: 'OPEN' | 'REQUIRES_APPROVAL';
    };

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check name uniqueness if changing
    if (name && name !== org.name) {
      const conflict = await prisma.organization.findUnique({ where: { name } });
      if (conflict) {
        return res.status(409).json({ error: 'An organization with this name already exists' });
      }
    }

    // Check domain uniqueness if changing (null clears the domain → open-domain org)
    if (domain !== undefined && domain !== org.domain) {
      if (domain !== null) {
        const conflict = await prisma.organization.findUnique({ where: { domain } });
        if (conflict) {
          return res.status(409).json({ error: 'An organization with this domain already exists' });
        }
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (domain !== undefined) data.domain = domain;
    if (joinPolicy !== undefined) data.joinPolicy = joinPolicy;

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data,
      select: {
        id: true,
        name: true,
        domain: true,
        status: true,
        joinPolicy: true,
        isClaimVerified: true,
        isDomainLocked: true,
      },
    });

    return res.json({ organization: updated });
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/super-admin/users/:id/role
// Unrestricted role setter — can promote to SUPER_ADMIN or demote from it.
// The org-scoped ADMIN version explicitly blocks SUPER_ADMIN assignment.
// ---------------------------------------------------------------------------
export const updateUserRoleAsSuperAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { role } = req.body as { role: 'USER' | 'REPRESENTATIVE' | 'ADMIN' | 'SUPER_ADMIN' };

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true },
    });

    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent self-demotion — a super admin demoting themselves would lock out the dashboard
    if (target.id === req.user?.userId && role !== 'SUPER_ADMIN') {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true },
    });

    return res.json({ user: updated });
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/super-admin/maintenance/purge-expired-tokens
// Delete expired or used EmailVerificationTokens and PasswordResetTokens.
// These accumulate indefinitely and are never cleaned up automatically.
// Body: { dryRun?: boolean }
// ---------------------------------------------------------------------------
export const purgeExpiredTokens = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const dryRun: boolean = req.body.dryRun ?? false;
    const now = new Date();

    const [expiredVerification, expiredPasswordReset] = await prisma.$transaction([
      prisma.emailVerificationToken.findMany({
        where: { OR: [{ expiresAt: { lt: now } }, { used: true }] },
        select: { id: true },
      }),
      prisma.passwordResetToken.findMany({
        where: { OR: [{ expiresAt: { lt: now } }, { used: true }] },
        select: { id: true },
      }),
    ]);

    const verificationIds = expiredVerification.map((t) => t.id);
    const passwordResetIds = expiredPasswordReset.map((t) => t.id);

    if (dryRun) {
      return res.json({
        dryRun,
        emailVerificationTokens: { affected: verificationIds.length },
        passwordResetTokens: { affected: passwordResetIds.length },
      });
    }

    const [deletedVerification, deletedPasswordReset] = await prisma.$transaction([
      prisma.emailVerificationToken.deleteMany({ where: { id: { in: verificationIds } } }),
      prisma.passwordResetToken.deleteMany({ where: { id: { in: passwordResetIds } } }),
    ]);

    return res.json({
      dryRun,
      emailVerificationTokens: { affected: deletedVerification.count },
      passwordResetTokens: { affected: deletedPasswordReset.count },
    });
  } catch (error) {
    return next(error);
  }
};
