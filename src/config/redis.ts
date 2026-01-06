import { createClient, type RedisClientType } from 'redis';
import { env } from './env.js';
import logger from './logger.js';

let client: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType> | null = null;

export function isRedisConfigured() {
  return Boolean(env.REDIS_URL);
}

export function getRedisClient(): RedisClientType | null {
  if (!env.REDIS_URL) return null;
  if (client) return client;

  client = createClient({ url: env.REDIS_URL });

  client.on('error', (err) => {
    logger.warn('Redis client error', { error: err instanceof Error ? err.message : String(err) });
  });

  client.on('reconnecting', () => {
    logger.warn('Redis client reconnecting');
  });

  return client;
}

export async function connectRedis(): Promise<RedisClientType | null> {
  if (!env.REDIS_URL) return null;

  if (connectPromise) return connectPromise;

  const redisClient = getRedisClient();
  if (!redisClient) return null;

  connectPromise = (async () => {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    logger.info('Redis connected');
    return redisClient;
  })();

  try {
    return await connectPromise;
  } catch (err) {
    // Reset so we can retry on next boot.
    connectPromise = null;

    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to connect to Redis', { error: message });

    // In production, fail fast if REDIS_URL is set (prevents silently falling back to memory store).
    if (env.NODE_ENV === 'production') {
      throw err;
    }

    return null;
  }
}
