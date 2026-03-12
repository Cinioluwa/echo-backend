import prisma from '../config/db.js';

export interface WaveBadgeInfo {
  isCommunityPick: boolean;
}

/**
 * Given an array of waves, computes and attaches wave-specific badge properties
 * like `isCommunityPick` (the most surged wave for its parent ping).
 */
export const appendWaveBadges = async <T extends { id: number; pingId: number; surgeCount: number }>(
  waves: T[],
  organizationId: number
): Promise<(T & WaveBadgeInfo)[]> => {
  if (!waves.length) return [];

  // Get unique ping IDs from the provided waves
  const pingIds = [...new Set(waves.map((w) => w.pingId))];

  // For each ping, find the single wave with the highest surge count
  // Since Prisma doesn't easily support DISTINCT ON in nested queries, we do a raw/groupBy workaround, or fetch the top wave per ping.
  // Because the number of distinct pingIds in a single paginated request is small (usually 1 if fetched via getWavesForPing, or up to `limit` in stream),
  // we can just fetch the top wave for each ping ID concurrently.
  const topWavesPromise = pingIds.map((pingId) =>
    prisma.wave.findFirst({
      where: { pingId, organizationId },
      orderBy: [{ surgeCount: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, surgeCount: true },
    })
  );

  const topWaves = await Promise.all(topWavesPromise);
  
  // A wave is a community pick if it's the exact top wave ID for its ping AND it has at least 1 surge (to avoid day-1 0-surge picks).
  const communityPickWaveIds = new Set(
    topWaves
      .filter((w) => w !== null && w.surgeCount > 0)
      .map((w) => w!.id)
  );

  return waves.map((wave) => ({
    ...wave,
    isCommunityPick: communityPickWaveIds.has(wave.id),
  }));
};
