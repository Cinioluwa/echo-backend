import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { getRedisClient, isRedisConfigured } from '../config/redis.js';
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

    const client = getRedisClient();
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

/**
 * Invalidate cache entries matching a pattern.
 * Useful for clearing cache when data changes.
 * 
 * @param pattern - Pattern to match (e.g., 'echo:cache:1:*' for org 1)
 */
export async function invalidateCache(pattern: string): Promise<number> {
  if (!isRedisConfigured()) return 0;

  const client = getRedisClient();
  if (!client || !client.isOpen) return 0;

  try {
    const keys = await client.keys(`${CACHE_PREFIX}${pattern}`);
    if (keys.length === 0) return 0;

    const deleted = await client.del(keys);
    logger.info('Cache invalidated', { pattern, keysDeleted: deleted });
    return deleted;
  } catch (err) {
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
