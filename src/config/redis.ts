import { createClient } from 'redis';
import { env } from './env.js';
import logger from './logger.js';

// Azure Managed Redis (Enterprise tier, port 10000) exposes a SINGLE endpoint.
// It does NOT implement OSS-cluster slot sharding — it has no MOVED redirects
// and does not respond to CLUSTER INFO / CLUSTER NODES.
//
// createCluster sends those discovery commands on connect and breaks on the
// CROSSSLOT / -ERR responses, producing a RESP decoder error that crashes
// the Node process (unhandled throw inside a socket data handler).
//
// createClient (standalone) connects to the single endpoint over TLS and works
// correctly. The `rediss://` scheme in the URL enables TLS automatically.
export type RedisClientType = ReturnType<typeof createClient>;

let client: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType> | null = null;

export function isRedisConfigured(): boolean {
  return Boolean(env.REDIS_URL);
}

/** Returns the already-connected client, or null if not yet connected. */
export function getConnectedClient(): RedisClientType | null {
  return client;
}

function buildRedisClient(): RedisClientType {
  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL is not defined');
  }
  // The `rediss://` scheme enables TLS. Azure uses self-signed certs on shard
  // nodes, so we disable strict cert validation.
  return createClient({
    url: env.REDIS_URL,
    socket: {
      tls: true,
      rejectUnauthorized: false,
      connectTimeout: 10_000,
      reconnectStrategy: (retries) => {
        // Back off quickly — don't hang the process indefinitely.
        if (retries >= 3) return new Error('Redis max reconnect attempts reached');
        return Math.min(retries * 500, 2000);
      },
    },
  });
}

export async function connectRedis(): Promise<RedisClientType | null> {
  if (!env.REDIS_URL) return null;
  if (connectPromise) return connectPromise;

  if (!client) {
    client = buildRedisClient();
    client.on('error', (err: Error) => {
      // Log but do NOT rethrow — an unhandled throw here becomes an
      // uncaughtException that exits the process.
      logger.warn('Redis client error', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  const redisClient = client;

  connectPromise = (async () => {
    // Race the connect call against a timeout so startup never hangs.
    const CONNECT_TIMEOUT_MS = 15_000;
    await Promise.race([
      redisClient.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Redis connect timed out after ${CONNECT_TIMEOUT_MS}ms`)), CONNECT_TIMEOUT_MS)
      ),
    ]);
    logger.info('Redis client connected');
    return redisClient;
  })();

  try {
    return await connectPromise;
  } catch (err) {
    connectPromise = null;
    client = null;
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to connect to Redis — falling back to in-memory store', { error: message });
    return null;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    try {
      await client.quit();
    } catch {
      // ignore
    } finally {
      client = null;
      connectPromise = null;
    }
  }
}