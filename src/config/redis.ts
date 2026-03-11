import { createClient } from 'redis';
import { env } from './env.js';
import logger from './logger.js';

// ─── REDIS SETUP NOTES ─────────────────────────────────────────────────────
//
// Provider: Upstash Redis (migrated from Azure Managed Redis)
//
// We use createClient (standalone), not createCluster. Upstash exposes a
// single TLS endpoint — there is no cluster-node discovery step needed.
// The `rediss://` scheme in REDIS_URL enables TLS automatically.
//
// IMPORTANT — Upstash does NOT support client.duplicate().
// Do NOT call redisClient.duplicate() anywhere (e.g. for Socket.IO pub/sub).
// Instead, build a second independent createClient() for the sub role.
// See socket.ts where pubClient and subClient are created separately.
//
// Error handling:
//   - The `error` listener only logs, never rethrows, to avoid uncaughtException.
//   - connectRedis() wraps in try/catch and resets state on failure.
//   - server.ts treats Redis as optional; a failed Redis connect does not
//     prevent the HTTP server from binding.
//
// ─────────────────────────────────────────────────────────────────────────────

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

/**
 * Build a single standalone Redis client for Upstash.
 * Pass the URL directly — the `rediss://` scheme handles TLS.
 * Do NOT call .duplicate() on the returned client; Upstash does not support it.
 */
export function buildRedisClient(url?: string): RedisClientType {
  const redisUrl = url ?? env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is not defined');
  }
  return createClient({
    url: redisUrl,
    socket: {
      tls: true,
      // Upstash uses publicly-trusted certs — rejectUnauthorized can stay true,
      // but false is harmless and keeps the config lenient for dev environments.
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