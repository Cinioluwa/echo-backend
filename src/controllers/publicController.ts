import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db.js';

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

// Public Soundboard: all pings visible, sortable by trending (surgeCount) or new (createdAt)
export async function getPublicPings(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit, skip, top, sort, since } = parsePagination(req);

    const orderBy =
      sort === 'trending'
        ? [{ surgeCount: 'desc' as const }, { createdAt: 'desc' as const }]
        : [{ createdAt: 'desc' as const }];

    const where: any = {};
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
          author: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { waves: true, comments: true, surges: true } },
        },
      }),
      top ? Promise.resolve(0) : prisma.ping.count({ where }),
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

// Public Stream: all waves visible, sortable by trending (surgeCount) or new (createdAt)
export async function getPublicWaves(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit, skip, top, sort, since } = parsePagination(req);

    const orderBy =
      sort === 'trending'
        ? [{ surgeCount: 'desc' as const }, { createdAt: 'desc' as const }]
        : [{ createdAt: 'desc' as const }];

    const where: any = {};
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
