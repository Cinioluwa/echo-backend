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
        },
      }),
      top ? Promise.resolve(0) : prisma.ping.count({ where }),
    ]);

    const sanitizedItems = items.map(sanitizePublicPing);

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

    const [items, total] = await Promise.all([
      prisma.wave.findMany({
        where,
        orderBy,
        skip: top ? 0 : skip,
        take: top ?? limit,
        include: {
          ping: { select: { id: true, title: true } },
          _count: { select: { surges: true, comments: true } },
        },
      }),
      top ? Promise.resolve(0) : prisma.wave.count({ where }),
    ]);

    res.status(200).json({
      data: items,
      pagination: top
        ? { top, sort }
        : { page: Math.floor(skip / limit) + 1, limit, total, sort },
    });
  } catch (error) {
    return next(error);
  }
}
