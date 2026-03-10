import { createClient } from 'redis';
import { env } from './env.js';
import logger from './logger.js';

// ─── PROBLEM HISTORY & LESSONS LEARNED ────────────────────────────────────────
//
// PROBLEM 1 — Wrong client type: createCluster vs createClient
// ─────────────────────────────────────────────────────────────
// Original code used `createCluster`, which is designed for OSS-style Redis
// clusters where the client discovers all shard nodes via CLUSTER SLOTS/SHARDS,
// and then opens a direct TCP/TLS connection to each discovered node.
//
// The Azure resource (Microsoft.Cache/redisEnterprise, Balanced B0) exposes a
// SINGLE public endpoint: echo.westeurope.redis.azure.net:10000
// The clustering policy is OSSCluster, but Azure's implementation routes
// commands through a managed load balancer — shard nodes are internal pod IPs
// (10.x.x.x) that are NOT reachable from outside the VNet (e.g. App Service).
//
// What happened:
//   1. createCluster connected to port 10000 ✓
//   2. Sent CLUSTER SLOTS → received internal pod IPs
//   3. Tried to open TLS connections to those unreachable IPs
//   4. Got garbage data back (TLS/TCP noise on a non-TLS socket)
//   5. The RESP decoder threw synchronously inside a socket data handler
//   6. Became an uncaughtException → process.exit(1) → ContainerTimeout crash
//
// FIX — Use createClient (standalone). The single Azure endpoint handles shard
// routing transparently at the proxy layer. The client never sees the internal
// shard topology, so this problem cannot occur.
//
// LESSON — For Azure Managed Redis Enterprise, always use createClient regardless
// of the clustering policy shown in the portal. The OSSCluster policy describes
// the server-side sharding strategy, not the client connectivity model.
// If internal shard nodes are not directly accessible, createCluster will crash.
//
// ─────────────────────────────────────────────────────────────────────────────
//
// PROBLEM 2 — RESP decoder crash was an uncaught exception
// ─────────────────────────────────────────────────────────
// The `error` event listener on the Redis client only handles errors emitted
// through the Node.js EventEmitter pipeline. A synchronous throw inside the
// RESP decoder (socket `data` handler) bypasses the error event and becomes
// an uncaughtException, which terminates the process in Node 15+.
//
// FIX — Switching to createClient eliminates the root cause. Additionally:
//   - The error listener now only logs (never rethrows)
//   - connectRedis() wraps everything in try/catch and resets state on failure
//   - server.ts no longer awaits Redis before binding the port (so a Redis
//     failure can never prevent the HTTP server from starting)
//
// LESSON — Never let third-party library errors propagate to uncaughtException
// in a long-running server. Always attach an `error` listener to every socket
// and EventEmitter, and treat Redis as an optional enhancement, not a hard dep.
//
// ──────────────────────────────────────────────────────────────────────────────

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
  // `rediss://` scheme enables TLS automatically.
  // rejectUnauthorized: false — Azure shard-node certs are self-signed.
  // reconnectStrategy — cap retries at 3 so a broken Redis connection does not
  // keep the process spinning indefinitely with backoff loops.
  return createClient({
    url: env.REDIS_URL,
    socket: {
      tls: true,
      rejectUnauthorized: false,
      connectTimeout: 10_000,
      reconnectStrategy: (retries) => {
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
    // Only log — never rethrow inside an event handler.
    // A throw here becomes uncaughtException and kills the process (Node 15+).
    client.on('error', (err: Error) => {
      logger.warn('Redis client error', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  const redisClient = client;

  connectPromise = (async () => {
    // Race connect against a timeout so startup never hangs waiting for Redis.
    // This is especially important on Azure App Service where the warm-up probe
    // has a fixed timeout window — a hung Redis connect would delay the server
    // bind and cause ContainerTimeout even if the app itself is healthy.
    const CONNECT_TIMEOUT_MS = 15_000;
    await Promise.race([
      redisClient.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Redis connect timed out after ${CONNECT_TIMEOUT_MS}ms`)),
          CONNECT_TIMEOUT_MS
        )
      ),
    ]);
    logger.info('Redis client connected');
    return redisClient;
  })();

  try {
    return await connectPromise;
  } catch (err) {
    // Reset so a subsequent call can retry cleanly.
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
      // ignore — process may already be shutting down
    } finally {
      client = null;
      connectPromise = null;
    }
  }
}