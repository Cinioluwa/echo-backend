import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';

const sanitizePublicPing = (ping: any) => ({
  ...ping,
  author: ping?.isAnonymous ? null : ping?.author ?? null,
});

function parsePagination(req: Request) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const skip = (page - 1) * limit;
  const top = req.query.top ? Math.max(1, Math.min(50, Number(req.query.top))) : undefined; // e.g., top=3
  const sort = (req.query.sort as string) === 'new' ? 'new' : 'trending'; // trending|new
  const days = req.query.days === 'all' ? 'all' : Number(req.query.days ?? 7);
  const since = days === 'all' ? undefined : new Date(Date.now() - (Number.isFinite(days) ? (days as number) : 7) * 24 * 60 * 60 * 1000);
  return { page, limit, skip, top, sort, since };
}

// Resolution Log: resolved pings for the user's organization.
export async function getPublicResolutionLog(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { limit, skip, top, since } = parsePagination(req);
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required.' });
    }

    const where: any = {
      organizationId,
      resolvedAt: { not: null },
    };
    if (since) {
      where.resolvedAt = { gte: since };
    }


    const userId = req.user?.userId;
    const [items, total] = await Promise.all([
      prisma.ping.findMany({
        where,
        orderBy: [{ resolvedAt: 'desc' as const }],
        skip: top ? 0 : skip,
        take: top ?? limit,
        select: {
          id: true,
          title: true,
          createdAt: true,
          resolvedAt: true,
          progressStatus: true,
          category: { select: { id: true, name: true } },
          officialResponse: { select: { id: true, content: true, createdAt: true } },
          waves: {
            where: { status: 'APPROVED' },
            orderBy: [{ createdAt: 'desc' }],
            take: 1,
            select: { id: true, solution: true, createdAt: true },
          },
          surges: userId ? { where: { userId }, select: { id: true } } : false,
        },
      }),
      top ? Promise.resolve(0) : prisma.ping.count({ where }),
    ]);

    const data = items.map((ping) => {
      const approvedWave = ping.waves?.[0] ?? null;
      const resolvedAt = ping.resolvedAt ?? null;
      const msToResolve = resolvedAt ? Math.max(0, resolvedAt.getTime() - ping.createdAt.getTime()) : null;

      return {
        id: ping.id,
        title: ping.title,
        category: ping.category,
        progressStatus: ping.progressStatus,
        createdAt: ping.createdAt,
        resolvedAt,
        msToResolve,
        approvedWave,
        officialResponse: ping.officialResponse ?? null,
        hasSurged: userId ? (ping.surges && ping.surges.length > 0) : false,
      };
    });

    return res.status(200).json({
      data,
      pagination: top
        ? { top }
        : { page: Math.floor(skip / limit) + 1, limit, total },
    });
  } catch (error) {
    return next(error);
  }
}

// Soundboard: all pings for the user's organization, sortable by trending or new
export async function getPublicPings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { limit, skip, top, sort, since } = parsePagination(req);
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required.' });
    }

    const orderBy =
      sort === 'trending'
        ? [{ surgeCount: 'desc' as const }, { createdAt: 'desc' as const }]
        : [{ createdAt: 'desc' as const }];

    const where: any = { organizationId };
    if (since) where.createdAt = { gte: since };
    
    const userId = req.user?.userId;
    const [items, total] = await Promise.all([
      prisma.ping.findMany({
        where,
        orderBy,
        skip: top ? 0 : skip,
        take: top ?? limit,
        select: {
          id: true,
          title: true,
          content: true,
          category: true,
          status: true,
          surgeCount: true,
          createdAt: true,
          isAnonymous: true,
          author: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { waves: true, comments: true, surges: true } },
          surges: userId ? { where: { userId }, select: { id: true } } : false,
        },
      }),
      top ? Promise.resolve(0) : prisma.ping.count({ where }),
    ]);

    const sanitizedItems = items.map((ping) => ({
      ...sanitizePublicPing(ping),
      hasSurged: userId ? (ping.surges && ping.surges.length > 0) : false,
    }));

    res.status(200).json({
      data: sanitizedItems,
      pagination: top
        ? { top, sort }
        : { page: Math.floor(skip / limit) + 1, limit, total, sort },
    });
  } catch (error) {
    return next(error);
  }
}

// Stream: all waves for the user's organization, sortable by trending or new
export async function getPublicWaves(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { limit, skip, top, sort, since } = parsePagination(req);
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required.' });
    }

    const orderBy =
      sort === 'trending'
        ? [{ surgeCount: 'desc' as const }, { createdAt: 'desc' as const }]
        : [{ createdAt: 'desc' as const }];

    const where: any = { organizationId };
    if (since) where.createdAt = { gte: since };

    const userId = req.user?.userId;
    const [items, total] = await Promise.all([
      prisma.wave.findMany({
        where,
        orderBy,
        skip: top ? 0 : skip,
        take: top ?? limit,
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true }
          },
          ping: {
            select: {
              id: true,
              title: true,
              content: true,
              createdAt: true,
              category: { select: { id: true, name: true } },
              author: { select: { id: true, firstName: true, lastName: true } },
              surges: userId ? { where: { userId }, select: { id: true } } : false,
            }
          },
          surges: userId ? { where: { userId }, select: { id: true } } : false,
          _count: { select: { surges: true, comments: true } },
        },
      }),
      top ? Promise.resolve(0) : prisma.wave.count({ where }),
    ]);

    // Add hasSurged and flatten ping fields
    const data = items.map(wave => ({
      ...wave,
      hasSurged: userId ? (wave.surges && wave.surges.length > 0) : false,
      author: wave.author,
      ping: {
        id: wave.ping.id,
        title: wave.ping.title,
        content: wave.ping.content,
        createdAt: wave.ping.createdAt,
        category: wave.ping.category,
        author: wave.ping.author,
        hasSurged: userId ? (wave.ping.surges && wave.ping.surges.length > 0) : false,
      },
      // Remove surges arrays from response for cleanliness
      surges: undefined,
    }));

    res.status(200).json({
      data,
      pagination: top
        ? { top, sort }
        : { page: Math.floor(skip / limit) + 1, limit, total, sort },
    });
  } catch (error) {
    return next(error);
  }
}
