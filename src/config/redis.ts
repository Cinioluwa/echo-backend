import { createCluster } from 'redis';
import { env } from './env.js';
import logger from './logger.js';

// Azure Managed Redis is configured with OSSCluster policy, which means it uses
// native Redis cluster-mode slot sharding. The server responds to commands with
// MOVED redirects pointing to the shard node that owns the key slot.
//
// createClient (standalone) cannot follow MOVED redirects — it throws immediately.
// createCluster is cluster-aware and follows MOVED/ASK redirects automatically.
//
// When the cluster client discovers internal shard nodes, it must connect to them
// over TLS (Azure rejects plaintext). `defaults.socket.tls` propagates TLS to all
// discovered nodes.
//
// The password must also be passed explicitly in `defaults` so it is sent to every
// shard node the cluster client is redirected to (NOAUTH otherwise).
export type RedisClusterType = ReturnType<typeof createCluster>;

let client: RedisClusterType | null = null;
let connectPromise: Promise<RedisClusterType> | null = null;

export function isRedisConfigured() {
  return Boolean(env.REDIS_URL);
}

/** Returns the already-connected client, or null if not yet connected. */
export function getConnectedClient(): RedisClusterType | null {
  return client;
}

function buildRedisClient(): RedisClusterType {
  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL is not defined');
  }
  const redisUrl = env.REDIS_URL;
  return createCluster({
    rootNodes: [{ url: redisUrl }],
    defaults: {
      password: new URL(redisUrl).password, // propagate auth to all shard nodes
      socket: {
        tls: true,
        rejectUnauthorized: false, // Azure shard nodes use self-signed certs
        connectTimeout: 10_000,
      },
    },
  });
}

export async function connectRedis(): Promise<RedisClusterType | null> {
  if (!env.REDIS_URL) return null;
  if (connectPromise) return connectPromise;

  if (!client) {
    client = buildRedisClient();
    client.on('error', (err: Error) => {
      logger.warn('Redis cluster error', { error: err instanceof Error ? err.message : String(err) });
    });
  }

  const redisClient = client;

  connectPromise = (async () => {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    logger.info('Redis cluster connected');
    return redisClient;
  })();

  try {
    return await connectPromise;
  } catch (err) {
    connectPromise = null;
    client = null;
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to connect to Redis cluster — falling back to in-memory store', { error: message });
    return null;
  }
}