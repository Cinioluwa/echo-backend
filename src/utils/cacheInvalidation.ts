import { invalidateOrgCache } from '../middleware/cacheMiddleware.js';
import logger from '../config/logger.js';

/**
 * Invalidate cache for an organization after a mutation (create/update/delete).
 * This should be called after any operation that changes data which might be cached.
 * 
 * The function is async but designed to not block the response - cache invalidation
 * failures are logged but don't affect the API response.
 * 
 * @param organizationId - The organization ID whose cache should be invalidated
 */
export async function invalidateCacheAfterMutation(organizationId: number | undefined): Promise<void> {
  if (!organizationId) {
    logger.debug('Cache invalidation skipped: no organizationId provided');
    return;
  }

  try {
    const keysDeleted = await invalidateOrgCache(organizationId);
    if (keysDeleted > 0) {
      logger.debug('Cache invalidated after mutation', { organizationId, keysDeleted });
    }
  } catch (err) {
    // Log but don't throw - cache invalidation should not break the main operation
    logger.warn('Cache invalidation failed', {
      organizationId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export default invalidateCacheAfterMutation;
