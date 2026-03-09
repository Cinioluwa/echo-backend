import { createCluster, type RedisClusterType } from 'redis';
import { env } from './env.js';
import logger from './logger.js';

let client: RedisClusterType | null = null;
let connectPromise: Promise<RedisClusterType> | null = null;

export function isRedisConfigured() {
  return Boolean(env.REDIS_URL);
}

export function getRedisClient(): RedisClusterType | null {
  if (!env.REDIS_URL) return null;
  if (client) return client;

  client = createCluster({
    rootNodes: [{ url: env.REDIS_URL }],
    defaults: {
      // createCluster does not auto-parse credentials from the root node URL.
      // The password must be explicitly provided in defaults.
      password: decodeURIComponent(new URL(env.REDIS_URL).password),
      socket: {
        tls: true,
        rejectUnauthorized: false, // Azure Managed Redis uses self-signed certs
      },
    },
    useReplicas: false,
  });

  client.on('error', (err: Error) => {
    logger.warn('Redis client error', { error: err instanceof Error ? err.message : String(err) });
  });

  return client;
}

export async function connectRedis(): Promise<RedisClusterType | null> {
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
    logger.error('Failed to connect to Redis — falling back to in-memory store', { error: message });

    return null;
  }
}
