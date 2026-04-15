import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../types/AuthRequest.js';
import { appendPingBadges } from '../utils/pingBadges.js';
import { appendWaveBadges } from '../utils/waveBadges.js';
import { env } from '../config/env.js';

type ShareEntity = 'feed' | 'ping' | 'wave' | 'comment';

const SHARE_DESCRIPTION_MAX_LENGTH = 180;

const trimText = (value: string | null | undefined, maxLength: number): string => {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
};

const safeImageUrl = (media: Array<{ url: string; mimeType: string }> | undefined): string | null => {
  if (!media || media.length === 0) return null;
  const image = media.find((item) => item.mimeType.startsWith('image/'));
  return image?.url ?? null;
};

const buildCanonicalUrl = (entity: ShareEntity, id: number, commentId?: number): string => {
  const appBaseUrl = env.APP_URL.replace(/\/$/, '');

  if (entity === 'comment' && commentId) {
    return `${appBaseUrl}/feed/${id}#comment-${commentId}`;
  }

  return `${appBaseUrl}/feed/${id}`;
};

const notFound = (res: Response) =>
  res.status(404).json({
    error: 'Content not found',
    code: 'SHARE_CONTENT_NOT_FOUND',
  });

const sanitizePublicPing = (ping: any, currentUserId?: string | number) => {
  const isOwner = currentUserId ? ping?.author?.id === currentUserId : false;
  const nonAnonymousAlias = [ping?.author?.firstName, ping?.author?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() || null;

  return {
    ...ping,
    author: ping?.isAnonymous ? null : ping?.author ?? null,
    anonymousAlias: ping?.isAnonymous ? (ping?.anonymousAlias ?? null) : undefined,
    anonymousProfilePicture: ping?.isAnonymous ? (ping?.anonymousProfilePicture ?? null) : undefined,
    isOwner,
    alias: ping?.isAnonymous ? (ping?.anonymousAlias ?? null) : nonAnonymousAlias,
  };
};

function parsePagination(req: Request) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const skip = (page - 1) * limit;
  const top = req.query.top ? Math.max(1, Math.min(50, Number(req.query.top))) : undefined; // e.g., top=3
  const sort = (req.query.sort as string) === 'new' ? 'new' : 'trending'; // trending|new
  const daysParam = req.query.days;
  const days = (!daysParam || daysParam === 'all') ? 'all' : Number(daysParam);
  const since = days === 'all' || !Number.isFinite(days) 
    ? undefined 
    : new Date(Date.now() - (days as number) * 24 * 60 * 60 * 1000);
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
            // A ping is considered resolved when a child wave is marked COMPLETED
            // (see admin wave status update rule).
            where: { status: 'COMPLETED' },
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

    // Filter by category if provided
    const categoryId = req.query.category ? Number(req.query.category) : undefined;
    if (categoryId) {
      where.categoryId = categoryId;
    }

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
          progressStatus: true,
          surgeCount: true,
          createdAt: true,
          isAnonymous: true,
          anonymousAlias: true,
          anonymousProfilePicture: true,
          author: { select: { id: true, firstName: true, lastName: true, profilePicture: true } },
          _count: { select: { waves: true, comments: true, surges: true } },
          waves: {
            take: 2,
            orderBy: [{ surgeCount: 'desc' }, { createdAt: 'desc' }],
            select: {
              id: true,
              solution: true,
              createdAt: true,
              surgeCount: true,
              author: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profilePicture: true,
                },
              },
              _count: { select: { surges: true, comments: true } },
            },
          },
          media: { select: { id: true, url: true, filename: true, mimeType: true, width: true, height: true } },
          surges: userId ? { where: { userId }, select: { id: true } } : false,
        },
      }),
      top ? Promise.resolve(0) : prisma.ping.count({ where }),
    ]);

    const sanitizedItems = items.map((ping) => ({
      ...sanitizePublicPing(ping, userId),
      hasSurged: userId ? (ping.surges && ping.surges.length > 0) : false,
      surges: undefined,
    }));

    const itemsWithBadges = await appendPingBadges(sanitizedItems, organizationId);

    res.status(200).json({
      data: itemsWithBadges,
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

    // Filter by category if provided
    const categoryId = req.query.category ? Number(req.query.category) : undefined;
    if (categoryId) {
      where.ping = { categoryId };
    }

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

    const dataWithBadges = await appendWaveBadges(data, organizationId);

    res.status(200).json({
      data: dataWithBadges,
      pagination: top
        ? { top, sort }
        : { page: Math.floor(skip / limit) + 1, limit, total, sort },
    });
  } catch (error) {
    return next(error);
  }
}

// Public share metadata for crawlers and frontend metadata generation.
// Safe-by-design: only returns fields that are acceptable for public link previews.
export async function getShareMetadata(req: Request, res: Response, next: NextFunction) {
  try {
    const entity = req.params.entity as ShareEntity;
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid share id' });
    }

    if (entity === 'ping') {
      const ping = await prisma.ping.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          content: true,
          media: {
            select: { url: true, mimeType: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!ping) return notFound(res);

      return res.status(200).json({
        type: 'ping',
        id: ping.id,
        title: trimText(ping.title, 110),
        description: trimText(ping.content, SHARE_DESCRIPTION_MAX_LENGTH),
        imageUrl: safeImageUrl(ping.media),
        canonicalUrl: buildCanonicalUrl('ping', ping.id),
      });
    }

    if (entity === 'wave') {
      const wave = await prisma.wave.findUnique({
        where: { id },
        select: {
          id: true,
          solution: true,
          pingId: true,
          ping: { select: { title: true } },
          media: {
            select: { url: true, mimeType: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!wave) return notFound(res);

      const title = wave.ping?.title
        ? `Solution to: ${trimText(wave.ping.title, 95)}`
        : `Solution #${wave.id}`;

      return res.status(200).json({
        type: 'wave',
        id: wave.id,
        title,
        description: trimText(wave.solution, SHARE_DESCRIPTION_MAX_LENGTH),
        imageUrl: safeImageUrl(wave.media),
        canonicalUrl: buildCanonicalUrl('wave', wave.pingId),
      });
    }

    if (entity === 'feed') {
      const ping = await prisma.ping.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          content: true,
          media: {
            select: { url: true, mimeType: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (ping) {
        return res.status(200).json({
          type: 'ping',
          id: ping.id,
          title: trimText(ping.title, 110),
          description: trimText(ping.content, SHARE_DESCRIPTION_MAX_LENGTH),
          imageUrl: safeImageUrl(ping.media),
          canonicalUrl: buildCanonicalUrl('feed', ping.id),
        });
      }

      const wave = await prisma.wave.findUnique({
        where: { id },
        select: {
          id: true,
          solution: true,
          pingId: true,
          ping: { select: { title: true } },
          media: {
            select: { url: true, mimeType: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!wave) return notFound(res);

      const title = wave.ping?.title
        ? `Solution to: ${trimText(wave.ping.title, 95)}`
        : `Solution #${wave.id}`;

      return res.status(200).json({
        type: 'wave',
        id: wave.id,
        title,
        description: trimText(wave.solution, SHARE_DESCRIPTION_MAX_LENGTH),
        imageUrl: safeImageUrl(wave.media),
        canonicalUrl: buildCanonicalUrl('feed', wave.pingId),
      });
    }

    // entity === 'comment'
    const comment = await prisma.comment.findUnique({
      where: { id },
      select: {
        id: true,
        content: true,
        pingId: true,
        waveId: true,
        ping: {
          select: {
            id: true,
            title: true,
            content: true,
            media: {
              select: { url: true, mimeType: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        wave: {
          select: {
            id: true,
            solution: true,
            pingId: true,
            ping: {
              select: {
                id: true,
                title: true,
                media: {
                  select: { url: true, mimeType: true },
                  orderBy: { createdAt: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!comment) return notFound(res);

    if (comment.ping) {
      return res.status(200).json({
        type: 'comment',
        id: comment.id,
        title: `Comment on: ${trimText(comment.ping.title, 95)}`,
        description: trimText(comment.content || comment.ping.content, SHARE_DESCRIPTION_MAX_LENGTH),
        imageUrl: safeImageUrl(comment.ping.media),
        canonicalUrl: buildCanonicalUrl('comment', comment.ping.id, comment.id),
      });
    }

    if (comment.wave?.ping) {
      return res.status(200).json({
        type: 'comment',
        id: comment.id,
        title: `Comment on a solution: ${trimText(comment.wave.ping.title, 80)}`,
        description: trimText(comment.content || comment.wave.solution, SHARE_DESCRIPTION_MAX_LENGTH),
        imageUrl: safeImageUrl(comment.wave.ping.media),
        canonicalUrl: buildCanonicalUrl('comment', comment.wave.ping.id, comment.id),
      });
    }

    return notFound(res);
  } catch (error) {
    return next(error);
  }
}
