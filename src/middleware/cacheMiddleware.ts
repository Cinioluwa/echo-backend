import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { isRedisConfigured, getConnectedClient } from '../config/redis.js';
import logger from '../config/logger.js';

/**
 * Cache key prefix to namespace all cache entries
 */
const CACHE_PREFIX = 'echo:cache:';

/**
 * Generate a cache key from the request.
 * Includes organization ID for multi-tenant isolation.
 */
function generateCacheKey(req: Request): string {
  const orgId = (req as Request & { organizationId?: number }).organizationId || 'global';
  const userId = (req as Request & { user?: { id: number } }).user?.id || 'anon';

  // For org-scoped routes, include orgId. For user-specific routes, include userId.
  // Default: org-scoped caching (most feeds are org-scoped, not user-specific)
  return `${CACHE_PREFIX}${orgId}:${req.originalUrl}`;
}

/**
 * Cache middleware factory.
 *
 * @param ttlSeconds - Time to live in seconds (default: 60)
 * @param options - Additional options
 * @returns Express middleware
 *
 * @example
 * // Cache for 60 seconds (default)
 * router.get('/stats', cache(), getStats);
 *
 * // Cache for 5 minutes
 * router.get('/analytics', cache(300), getAnalytics);
 *
 * // Cache with user-specific key
 * router.get('/my-feed', cache(60, { perUser: true }), getMyFeed);
 */
export function cache(
  ttlSeconds: number = 60,
  options: { perUser?: boolean } = {}
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip caching if Redis is not configured
    if (!isRedisConfigured()) {
      next();
      return;
    }

    const client = getConnectedClient();
    if (!client || !client.isOpen) {
      next();
      return;
    }

    // Generate cache key
    let cacheKey = generateCacheKey(req);
    if (options.perUser) {
      const userId = (req as Request & { user?: { id: number } }).user?.id || 'anon';
      cacheKey = `${cacheKey}:user:${userId}`;
    }

    try {
      // Check cache
      const cached = await client.get(cacheKey);
      if (cached) {
        logger.debug('Cache HIT', { key: cacheKey });
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Content-Type', 'application/json');
        res.send(cached);
        return;
      }

      logger.debug('Cache MISS', { key: cacheKey });
      res.setHeader('X-Cache', 'MISS');

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override res.json to cache the response
      res.json = (body: unknown): Response => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const jsonString = JSON.stringify(body);

          // Cache asynchronously (don't block response)
          client.setEx(cacheKey, ttlSeconds, jsonString).catch((err) => {
            logger.warn('Failed to cache response', {
              key: cacheKey,
              error: err instanceof Error ? err.message : String(err)
            });
          });
        }

        return originalJson(body);
      };

      next();
    } catch (err) {
      // On any Redis error, proceed without caching
      logger.warn('Cache middleware error', {
        error: err instanceof Error ? err.message : String(err)
      });
      next();
    }
  };
}

// ─── PROBLEM: Cache invalidation — per-key DEL and broken SCAN loop ──────────
//
// Version 1 (initial): Used a manual SCAN cursor loop calling del() per key:
//   do {
//     reply = await client.scan(cursor, { MATCH: pattern }); // cursor as string
//     for (key of reply.keys) await client.del(key);         // one trip per key
//   } while (cursor !== '0');
//
// Two bugs:
//   A) cursor comparison: Redis v5 returns cursor as a number, not a string.
//      Comparing to '0' sometimes produced an infinite loop when cursor was 0.
//
//   B) Per-key DEL on Azure Managed Redis produced:
//      "ERR wrong number of arguments for 'del' command"
//      This is a server error when key arrives malformed (empty Buffer, etc.).
//      The error was caught and logged as a warn, but cache invalidation
//      silently failed on every login — so stale data was never cleared.
//
// FIX:
//   1. Replace manual cursor loop with scanIterator (cursor management is
//      handled internally by the redis client, cursor type mismatch is gone).
//   2. Collect all matched keys into an array, then issue a SINGLE batched DEL:
//        await client.del(keysToDelete)  ← one round trip, not N
//   3. Guard DEL with keysToDelete.length > 0 to never send DEL with 0 args.
//   4. Cast each key to String(key) — scanIterator can yield string | Buffer
//      depending on the client configuration; forcing string is safe.
//
// LESSON — Redis array-argument commands (DEL, MGET, UNLINK) must always be
// called with at least one argument. Batch where possible — it's faster and
// avoids the per-call overhead on managed Redis services with network latency.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Invalidate cache entries matching a pattern.
 * Useful for clearing cache when data changes.
 *
 * @param pattern - Pattern to match (e.g., '1:*' for org 1)
 */
export async function invalidateCache(pattern: string): Promise<number> {
  if (!isRedisConfigured()) return 0;

  const client = getConnectedClient();
  if (!client || !client.isOpen) return 0;

  try {
    let totalDeleted = 0;
    const matchPattern = `${CACHE_PREFIX}${pattern}`;
    const keysToDelete: string[] = [];

    for await (const key of client.scanIterator({ MATCH: matchPattern, COUNT: 100 })) {
      if (key) keysToDelete.push(String(key));
    }

    if (keysToDelete.length > 0) {
      totalDeleted = await client.del(keysToDelete);
    }

    if (totalDeleted > 0) {
      logger.info('Cache invalidated', { pattern, keysDeleted: totalDeleted });
    }
    return totalDeleted;
  } catch (err: unknown) {
    logger.warn('Cache invalidation failed', {
      pattern,
      error: err instanceof Error ? err.message : String(err)
    });
    return 0;
  }
}

/**
 * Invalidate all cache entries for an organization.
 * Call this when significant data changes occur.
 *
 * @param organizationId - The organization ID
 */
export async function invalidateOrgCache(organizationId: number): Promise<number> {
  return invalidateCache(`${organizationId}:*`);
}

export default cache;
