import prisma from '../config/db.js';

const DAYS_IN_MS = 24 * 60 * 60 * 1000;

export interface PingBadgeInfo {
  hasWave: boolean;
  isTop3: boolean;
  weeklyRank: number | null;
  isTrending: boolean;
}

/**
 * Given an array of pings (which must include _count.waves and _count.surges),
 * computes and attaches badge properties to each ping.
 */
export const appendPingBadges = async <T extends { id: number; organizationId: number; _count?: { waves: number } }>(
  pings: T[],
  organizationId: number
): Promise<(T & PingBadgeInfo)[]> => {
  if (!pings.length) return [];

  const pingIds = [...new Set(pings.map((p) => p.id))];

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * DAYS_IN_MS);
  const oneDayAgo = new Date(now.getTime() - 1 * DAYS_IN_MS);

  // 1. Find Top 3 Pings This Week (by surges in the last 7 days)
  const topSurgedThisWeek = await prisma.surge.groupBy({
    by: ['pingId'],
    where: {
      organizationId,
      createdAt: { gte: oneWeekAgo },
      pingId: { in: pingIds },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 3,
  });

  const top3Map = new Map<number, number>(); // pingId -> rank
  topSurgedThisWeek.forEach((item, index) => {
    if (item.pingId) {
      top3Map.set(item.pingId, index + 1);
    }
  });

  // 2. Find Trending Pings (high velocity in last 24 hours, e.g., >= 3 surges)
  const trendingRecent = await prisma.surge.groupBy({
    by: ['pingId'],
    where: {
      organizationId,
      createdAt: { gte: oneDayAgo },
      pingId: { in: pingIds },
    },
    _count: { id: true },
  });

  // Prisma `having` support differs across providers (SQLite in tests). Filter in JS for portability.
  const trendingSet = new Set(
    trendingRecent
      .filter((item) => (item as any)._count?.id >= 3)
      .map((item) => item.pingId)
  );

  return pings.map(ping => {
    const rank = top3Map.get(ping.id);
    return {
      ...ping,
      hasWave: (ping._count?.waves ?? 0) > 0,
      isTop3: rank !== undefined,
      weeklyRank: rank ?? null,
      isTrending: trendingSet.has(ping.id),
    };
  });
};
