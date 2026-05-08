import prisma from '../config/db.js';
import { ProgressStatus, Status } from '@prisma/client';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ── Badge types ───────────────────────────────────────────────────────────────

export type AdminBadgeKey =
  | 'SURGING_NOW'
  | 'RISING_QUICKLY'
  | 'LONG_OVERDUE'
  | 'HIGH_DISCUSSION'
  | 'WIDESPREAD'
  | 'NEEDS_ATTENTION'
  | 'SOLUTION_READY';

export interface AdminBadge {
  key: AdminBadgeKey;
  label: string;
  group: 'urgency' | 'breadth' | 'inaction';
}

// Priority order: highest priority first (max 2 badges per ping)
const BADGE_PRIORITY: AdminBadgeKey[] = [
  'SURGING_NOW',
  'LONG_OVERDUE',
  'WIDESPREAD',
  'SOLUTION_READY',
  'NEEDS_ATTENTION',
  'RISING_QUICKLY',
  'HIGH_DISCUSSION',
];

const BADGE_META: Record<AdminBadgeKey, Omit<AdminBadge, 'key'>> = {
  SURGING_NOW:     { label: 'Surging now',     group: 'urgency'  },
  RISING_QUICKLY:  { label: 'Rising quickly',  group: 'urgency'  },
  LONG_OVERDUE:    { label: 'Long overdue',     group: 'urgency'  },
  HIGH_DISCUSSION: { label: 'High discussion',  group: 'breadth'  },
  WIDESPREAD:      { label: 'Widespread',       group: 'breadth'  },
  NEEDS_ATTENTION: { label: 'Needs attention',  group: 'inaction' },
  SOLUTION_READY:  { label: 'Solution ready',   group: 'inaction' },
};

// ── Keyword extraction for Widespread ────────────────────────────────────────

/**
 * Common English stopwords and short filler words we want to ignore when
 * finding overlapping topics between pings.
 */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can',
  'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him',
  'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who',
  'did', 'its', 'let', 'put', 'too', 'use', 'with', 'this', 'that', 'from',
  'they', 'know', 'will', 'want', 'been', 'good', 'much', 'some', 'time',
  'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many',
  'more', 'only', 'over', 'such', 'take', 'than', 'them', 'then', 'well',
  'were', 'what', 'your', 'about', 'after', 'also', 'back', 'being',
  'does', 'each', 'even', 'give', 'have', 'into', 'keep', 'last', 'left',
  'life', 'made', 'mean', 'most', 'must', 'need', 'same', 'show', 'still',
  'stop', 'their', 'there', 'these', 'think', 'those', 'through',
  'under', 'until', 'upon', 'using', 'while', 'where', 'which', 'should',
  'would', 'could', 'other', 'might', 'shall', 'every', 'issue', 'ping',
  'please', 'really', 'school', 'always', 'never', 'nothing', 'something',
]);

/**
 * Extract meaningful keywords from a text string.
 * Words must be at least 4 characters and not in the stopword list.
 */
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

// ── Wave statuses that count as "admin action taken" ─────────────────────────

const ACTION_STATUSES = new Set<string>([
  Status.APPROVED,
  Status.IN_PROGRESS,
  Status.COMPLETED,
  Status.ON_HOLD,
]);

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compute and attach admin-only triage badges to an array of pings.
 *
 * Badges are visible only to ADMIN / REPRESENTATIVE roles — never to regular users.
 * At most **2** badges are returned per ping, in the defined priority order.
 *
 * @param pings               Pings already in memory (must include id, surgeCount,
 *                            createdAt, acknowledgedAt, resolvedAt, progressStatus,
 *                            title, hashtag, _count.waves, _count.comments)
 * @param organizationId      Multi-tenancy scope
 * @param includeDetailBadges When true, HIGH_DISCUSSION is also evaluated.
 *                            Pass `true` only on the full ping-detail endpoint —
 *                            the design spec marks that badge as "detail only".
 */
export const appendAdminPingBadges = async <
  T extends {
    id: number;
    organizationId: number;
    surgeCount: number;
    createdAt: Date;
    acknowledgedAt: Date | null;
    resolvedAt: Date | null;
    progressStatus: string;
    title: string;
    hashtag?: string | null;
    _count?: { waves?: number; comments?: number };
  }
>(
  pings: T[],
  organizationId: number,
  includeDetailBadges = false
): Promise<(T & { adminBadges: AdminBadge[] })[]> => {
  if (!pings.length) return [];

  const pingIds = pings.map((p) => p.id);
  const now = Date.now();
  const oneDayAgo    = new Date(now - MS_PER_DAY);
  const sevenDaysAgo = new Date(now - 7  * MS_PER_DAY);

  // ── Batch queries (run in parallel) ──────────────────────────────────────
  const [surges24h, surges7d, waveRows, orgPingRows] = await Promise.all([

    // 1. Surge count per ping in the last 24 h  →  "Surging now"
    prisma.surge.groupBy({
      by: ['pingId'],
      where: {
        organizationId,
        createdAt: { gte: oneDayAgo },
        pingId: { in: pingIds },
      },
      _count: { id: true },
    }),

    // 2. Surge count per ping in the last 7 days  →  "Rising quickly"
    prisma.surge.groupBy({
      by: ['pingId'],
      where: {
        organizationId,
        createdAt: { gte: sevenDaysAgo },
        pingId: { in: pingIds },
      },
      _count: { id: true },
    }),

    // 3. Waves for these pings (status + surgeCount)
    //    →  "Solution ready" and "wave action taken" detection
    prisma.wave.findMany({
      where: {
        organizationId,
        pingId: { in: pingIds },
        status: { not: Status.REJECTED },
      },
      select: {
        pingId: true,
        surgeCount: true,
        status: true,
      },
    }),

    // 4. All unresolved pings in the org (title, hashtag, surgeCount)
    //    →  "Widespread" keyword / hashtag overlap
    prisma.ping.findMany({
      where: {
        organizationId,
        progressStatus: { not: ProgressStatus.RESOLVED },
      },
      select: { id: true, title: true, hashtag: true, surgeCount: true },
    }),
  ]);

  // ── Build lookup maps ─────────────────────────────────────────────────────

  // velocity24h: pingId → surge count in last 24 h
  const velocity24h = new Map<number, number>();
  for (const row of surges24h) {
    if (row.pingId !== null) velocity24h.set(row.pingId, (row._count as any).id ?? 0);
  }

  // velocity7d: pingId → surge count in last 7 days
  const velocity7d = new Map<number, number>();
  for (const row of surges7d) {
    if (row.pingId !== null) velocity7d.set(row.pingId, (row._count as any).id ?? 0);
  }

  // waveActionTaken: set of pingIds where admin has acted on at least one wave
  // topWaveSurge: pingId → highest surgeCount across its non-rejected waves
  const waveActionTaken = new Set<number>();
  const topWaveSurge    = new Map<number, number>();
  for (const w of waveRows) {
    if (w.pingId === null) continue;
    if (ACTION_STATUSES.has(w.status)) waveActionTaken.add(w.pingId);
    const current = topWaveSurge.get(w.pingId) ?? 0;
    if (w.surgeCount > current) topWaveSurge.set(w.pingId, w.surgeCount);
  }

  // ── Widespread: build inverted keyword/hashtag index ─────────────────────
  //
  // Strategy (no AI required):
  //   1. Tokenise every unresolved org ping's title into significant keywords
  //      (min 4 chars, not a stopword) and include the hashtag if present.
  //   2. Build a keyword → Set<pingId> inverted index.
  //   3. For each ping in our result set, find all OTHER pings that share at
  //      least one keyword/hashtag token.
  //   4. If there are 2+ total pings in the matched group AND their combined
  //      surgeCount > 150, the ping earns the Widespread badge.

  const keywordToPingIds = new Map<string, Set<number>>();
  for (const op of orgPingRows) {
    const tokens = [
      ...extractKeywords(op.title),
      ...(op.hashtag ? [op.hashtag.toLowerCase().replace(/^#/, '')] : []),
    ];
    for (const token of tokens) {
      if (!keywordToPingIds.has(token)) keywordToPingIds.set(token, new Set());
      keywordToPingIds.get(token)!.add(op.id);
    }
  }

  const orgPingSurge = new Map<number, number>();
  for (const op of orgPingRows) orgPingSurge.set(op.id, op.surgeCount);

  const widespreadSet = new Set<number>();
  for (const ping of pings) {
    const tokens = [
      ...extractKeywords(ping.title),
      ...(ping.hashtag ? [ping.hashtag.toLowerCase().replace(/^#/, '')] : []),
    ];

    // Collect related ping IDs (share at least one significant token)
    const relatedIds = new Set<number>();
    for (const token of tokens) {
      const matches = keywordToPingIds.get(token);
      if (matches) {
        for (const id of matches) {
          if (id !== ping.id) relatedIds.add(id);
        }
      }
    }

    // Need at least 1 other related ping (2+ total in the group)
    if (relatedIds.size < 1) continue;

    const combinedSurges =
      (orgPingSurge.get(ping.id) ?? ping.surgeCount) +
      Array.from(relatedIds).reduce((sum, id) => sum + (orgPingSurge.get(id) ?? 0), 0);

    if (combinedSurges > 150) {
      widespreadSet.add(ping.id);
    }
  }

  // ── Evaluate badges per ping, apply priority cap ──────────────────────────
  return pings.map((ping) => {
    const eligible = new Set<AdminBadgeKey>();

    const v24h       = velocity24h.get(ping.id) ?? 0;
    const v7dTotal   = velocity7d.get(ping.id) ?? 0;
    const v7dPerDay  = v7dTotal / 7;
    const surges     = ping.surgeCount;
    const comments   = ping._count?.comments ?? 0;
    const isUnresolved   = ping.progressStatus !== ProgressStatus.RESOLVED && !ping.resolvedAt;
    const isAcknowledged = !!ping.acknowledgedAt;
    const hasWaveAction  = waveActionTaken.has(ping.id);
    const topWave        = topWaveSurge.get(ping.id) ?? 0;
    const daysSinceCreated = (now - ping.createdAt.getTime()) / MS_PER_DAY;

    // — Urgency —
    if (v24h > 20)
      eligible.add('SURGING_NOW');

    // Rising quickly: average daily velocity in the 7-day window is 8–20 surges/day
    // but NOT already surging now (avoid overlapping urgency signals)
    if (v7dPerDay >= 8 && v7dPerDay <= 20 && v24h <= 20)
      eligible.add('RISING_QUICKLY');

    if (daysSinceCreated > 21 && surges > 50 && isUnresolved)
      eligible.add('LONG_OVERDUE');

    // — Breadth —
    // HIGH_DISCUSSION is "detail only" — only evaluated when caller requests it
    if (includeDetailBadges && comments > 20 && surges > 0 && comments / surges > 0.15)
      eligible.add('HIGH_DISCUSSION');

    if (widespreadSet.has(ping.id))
      eligible.add('WIDESPREAD');

    // — Inaction —
    if (!isAcknowledged && !hasWaveAction && surges > 30)
      eligible.add('NEEDS_ATTENTION');

    // Solution ready: top wave has > 60 % of the ping's total surge share
    // and no admin wave action has been taken yet
    if (surges > 0 && topWave > 0 && topWave / surges > 0.6 && !hasWaveAction)
      eligible.add('SOLUTION_READY');

    // Apply priority order, cap at 2
    const badges: AdminBadge[] = [];
    for (const key of BADGE_PRIORITY) {
      if (eligible.has(key)) {
        badges.push({ key, ...BADGE_META[key] });
        if (badges.length === 2) break;
      }
    }

    return { ...ping, adminBadges: badges };
  });
};
