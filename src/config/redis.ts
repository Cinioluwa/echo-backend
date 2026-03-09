import { createClient, type RedisClientType } from 'redis';
import { env } from './env.js';
import logger from './logger.js';

// Azure Managed Redis exposes a single TLS endpoint (*.redis.azure.net:10000).
// It does NOT respond to CLUSTER SLOTS/SHARDS commands, so createCluster() leaves
// the slot table empty and every command crashes. Use createClient (standalone) instead.
let client: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType> | null = null;

export function isRedisConfigured() {
  return Boolean(env.REDIS_URL);
}

/** Returns the already-connected client, or null if not yet connected. */
export function getConnectedClient(): RedisClientType | null {
  return client;
}

function buildRedisClient(): RedisClientType {
  return createClient({
    url: env.REDIS_URL,
    socket: {
      tls: true,
      rejectUnauthorized: false, // Azure Managed Redis uses self-signed certs
      connectTimeout: 10_000,    // fail fast if unreachable; don't stall startup
    },
  }) as RedisClientType;
}

export async function connectRedis(): Promise<RedisClientType | null> {
  if (!env.REDIS_URL) return null;

  if (connectPromise) return connectPromise;

  if (!client) {
    client = buildRedisClient();
    client.on('error', (err: Error) => {
      logger.warn('Redis client error', { error: err instanceof Error ? err.message : String(err) });
    });
  }

  const redisClient = client;

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
    client = null;

    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to connect to Redis — falling back to in-memory store', { error: message });

    return null;
  }
}
