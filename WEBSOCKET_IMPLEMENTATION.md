# WebSocket Implementation Plan

## Overview

This document details the WebSocket implementation for Echo, covering five real-time features that eliminate polling, reduce server load, and deliver an instant user experience.

**Stack:** Socket.IO v4 + `@socket.io/redis-adapter` (leveraging our existing Redis instance)

### Features Covered

| #   | Feature                                                     | Priority  | Description                               |
| --- | ----------------------------------------------------------- | --------- | ----------------------------------------- |
| 1   | [Live Notification Delivery](#1-live-notification-delivery) | Critical  | Push notifications instantly to users     |
| 2   | [Live Surge Counts](#2-live-surge-counts)                   | Critical  | Real-time upvote count updates            |
| 3   | [Live Feed Updates](#3-live-feed-updates)                   | Critical  | New pings/waves appear on feeds instantly |
| 4   | [Live Comment Threads](#4-live-comment-threads)             | Critical  | Comments stream into detail pages live    |
| 6   | [Announcement Broadcast](#6-announcement-broadcast)         | Important | Instant org-wide announcement delivery    |

---

## Dependencies

```bash
npm install socket.io @socket.io/redis-adapter
npm install -D @types/socket.io
```

No additional infrastructure — we already run Redis (`redis@^5.10.0`) and this adapter uses the same connection.

---

## Architecture

### Connection Flow

```
Client connects with JWT
        │
        ▼
┌─────────────────────────┐
│  Socket.IO Auth Middleware │
│  - Verify JWT             │
│  - Load user from DB      │
│  - Reject if inactive     │
└─────────────────────────┘
        │
        ▼
┌─────────────────────────┐
│  Auto-Join Rooms          │
│  - user:{userId}          │
│  - org:{organizationId}   │
└─────────────────────────┘
        │
        ▼
  Client emits room joins
  as they navigate pages
  (ping:123, wave:456)
```

### Room Structure

| Room         | Format                 | Members                 | Purpose                                |
| ------------ | ---------------------- | ----------------------- | -------------------------------------- |
| User         | `user:{userId}`        | Single user             | Personal notifications                 |
| Organization | `org:{organizationId}` | All org members         | Surges, new pings/waves, announcements |
| Ping Detail  | `ping:{pingId}`        | Users viewing that ping | Live comments on a ping                |
| Wave Detail  | `wave:{waveId}`        | Users viewing that wave | Live comments on a wave                |

Rooms provide automatic scoping — events only reach users who need them. Socket.IO handles membership bookkeeping.

### Scaling

The `@socket.io/redis-adapter` publishes events through Redis Pub/Sub, so multiple server instances share the same room state. No code changes needed when scaling horizontally.

---

## Server Setup

### File: `src/config/socket.ts`

The Socket.IO server attaches to the existing HTTP server instance. The `server.ts` startup sequence needs a small refactor: extract the `http.Server` so Socket.IO can attach to it.

```ts
import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type { RedisClientType } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { prisma } from './database';
import { logger } from '../utils/logger';
import { env } from './env';

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export async function initializeSocketIO(
  httpServer: HttpServer,
  redisClient: RedisClientType
): Promise<SocketIOServer> {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ─── Redis Adapter ───
  const pubClient = redisClient.duplicate();
  const subClient = redisClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));

  // ─── Auth Middleware ───
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        userId: number;
        organizationId: number;
        role: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, organizationId: true, role: true, status: true },
      });

      if (!user || user.status !== 'ACTIVE') {
        return next(new Error('User not found or inactive'));
      }

      socket.data.userId = user.id;
      socket.data.organizationId = user.organizationId;
      socket.data.role = user.role;

      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // ─── Connection Handler ───
  io.on('connection', (socket) => {
    const { userId, organizationId } = socket.data;

    // Auto-join personal + org rooms
    socket.join(`user:${userId}`);
    socket.join(`org:${organizationId}`);

    logger.info(`WS connected: user=${userId} org=${organizationId}`);

    // Client joins a ping detail page
    socket.on('join:ping', (pingId: number) => {
      socket.join(`ping:${pingId}`);
    });

    // Client leaves a ping detail page
    socket.on('leave:ping', (pingId: number) => {
      socket.leave(`ping:${pingId}`);
    });

    // Client joins a wave detail page
    socket.on('join:wave', (waveId: number) => {
      socket.join(`wave:${waveId}`);
    });

    // Client leaves a wave detail page
    socket.on('leave:wave', (waveId: number) => {
      socket.leave(`wave:${waveId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`WS disconnected: user=${userId}`);
    });
  });

  logger.info('Socket.IO initialized with Redis adapter');
  return io;
}
```

### File: `src/server.ts` (changes)

```ts
import http from 'http';
import { createApp } from './app';
import { connectRedis } from './config/redis';
import { connectDatabase } from './config/database';
import { initializeSocketIO } from './config/socket';
import { env } from './config/env';
import { logger } from './utils/logger';

(async () => {
  const redisClient = await connectRedis();
  await connectDatabase();

  const app = createApp({ redisClient });

  // Create HTTP server explicitly so Socket.IO can attach
  const httpServer = http.createServer(app);

  // Initialize Socket.IO on the same server
  await initializeSocketIO(httpServer, redisClient);

  httpServer.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`🚀 Server is listening on port ${env.PORT}`);
  });
})();
```

**Key change:** Replace `app.listen()` with `http.createServer(app)` + `httpServer.listen()` so Socket.IO shares the same port. No new ports to expose.

---

## Emitter Utility

### File: `src/utils/socketEmitter.ts`

A thin helper that controllers call after successful mutations. It imports `getIO()` and emits to the correct room. If Socket.IO isn't initialized (e.g., in tests), calls are no-ops.

```ts
import { getIO } from '../config/socket';
import { logger } from './logger';

function safeEmit(room: string, event: string, payload: unknown): void {
  try {
    getIO().to(room).emit(event, payload);
  } catch {
    // Socket.IO not initialized (unit tests, scripts) — silently skip
  }
}

// ─── Feature 1: Notifications ───
export function emitNotification(userId: number, notification: object): void {
  safeEmit(`user:${userId}`, 'notification:new', notification);
}

// ─── Feature 2: Surges ───
export function emitPingSurgeUpdate(
  organizationId: number,
  data: { pingId: number; surgeCount: number; surged: boolean }
): void {
  safeEmit(`org:${organizationId}`, 'ping:surgeUpdate', data);
}

export function emitWaveSurgeUpdate(
  organizationId: number,
  data: { waveId: number; surgeCount: number; surged: boolean }
): void {
  safeEmit(`org:${organizationId}`, 'wave:surgeUpdate', data);
}

// ─── Feature 3: Feed Updates ───
export function emitPingCreated(organizationId: number, ping: object): void {
  safeEmit(`org:${organizationId}`, 'ping:created', ping);
}

export function emitPingDeleted(organizationId: number, pingId: number): void {
  safeEmit(`org:${organizationId}`, 'ping:deleted', { pingId });
}

export function emitWaveCreated(organizationId: number, wave: object): void {
  safeEmit(`org:${organizationId}`, 'wave:created', wave);
}

export function emitWaveDeleted(organizationId: number, waveId: number): void {
  safeEmit(`org:${organizationId}`, 'wave:deleted', { waveId });
}

// ─── Feature 4: Comments ───
export function emitCommentOnPing(pingId: number, comment: object): void {
  safeEmit(`ping:${pingId}`, 'comment:created', comment);
}

export function emitCommentOnWave(waveId: number, comment: object): void {
  safeEmit(`wave:${waveId}`, 'comment:created', comment);
}

// ─── Feature 6: Announcements ───
export function emitAnnouncement(organizationId: number, announcement: object): void {
  safeEmit(`org:${organizationId}`, 'announcement:new', announcement);
}
```

---

## Feature Integration Points

### 1. Live Notification Delivery

**Problem:** Frontend polls `GET /api/notifications/unread-count` (cached 15s) and `GET /api/notifications` (cached 30s) to detect new notifications.

**Solution:** After every `createNotification()` call, emit the notification object to the user's personal room.

**Events:**

| Event              | Room            | Payload                    |
| ------------------ | --------------- | -------------------------- |
| `notification:new` | `user:{userId}` | Full `Notification` object |

**Controller Changes:**

In `src/services/notificationService.ts` — modify `createNotification`:

```ts
import { emitNotification } from '../utils/socketEmitter';

export const createNotification = async (db: PrismaLike, input: CreateNotificationInput) => {
  const notification = await db.notification.create({
    data: {
      /* ... existing code ... */
    },
  });

  // Push to user in real time
  emitNotification(input.userId, notification);

  return notification;
};
```

In `createAnnouncementNotificationsForOrg` — after the bulk `createMany`, emit individually to each user:

```ts
// After createMany completes:
for (const user of users) {
  emitNotification(user.id, {
    userId: user.id,
    organizationId: params.organizationId,
    type: 'ANNOUNCEMENT_POSTED',
    title: params.title,
    body: params.body,
    announcementId: params.announcementId,
    read: false,
  });
}
```

**Affected files:**

- `src/services/notificationService.ts`

**Client usage:**

```ts
socket.on('notification:new', (notification) => {
  // Increment unread badge count
  // Optionally show toast
  // Prepend to notification list if panel is open
});
```

---

### 2. Live Surge Counts

**Problem:** After surging, only the user who surged sees the updated count. All other users see stale data until they refresh or the cache expires.

**Solution:** After toggling a surge, broadcast the new count to the entire organization room.

**Events:**

| Event              | Room                   | Payload                          |
| ------------------ | ---------------------- | -------------------------------- |
| `ping:surgeUpdate` | `org:{organizationId}` | `{ pingId, surgeCount, surged }` |
| `wave:surgeUpdate` | `org:{organizationId}` | `{ waveId, surgeCount, surged }` |

**Controller Changes:**

In `src/controllers/surgeController.ts` — add emits after the count is updated:

```ts
import { emitPingSurgeUpdate, emitWaveSurgeUpdate } from '../utils/socketEmitter';

// In toggleSurgeOnPing, after updating surgeCount:
emitPingSurgeUpdate(req.organizationId!, {
  pingId: pingIdInt,
  surgeCount: count,
  surged: !existingSurge, // true if created, false if removed
});

// In toggleSurgeOnWave, after updating surgeCount:
emitWaveSurgeUpdate(req.organizationId!, {
  waveId: waveIdInt,
  surgeCount: count,
  surged: !existingSurge,
});
```

**Affected files:**

- `src/controllers/surgeController.ts`

**Client usage:**

```ts
socket.on('ping:surgeUpdate', ({ pingId, surgeCount }) => {
  // Update the surge count on the matching ping card in the feed
  // or on the detail page
});
```

> **Note:** The `surged` field in the broadcast reflects the acting user's state. Each client should only use `surgeCount` for display; their own `surged` boolean state should come from their own API calls or local state.

---

### 3. Live Feed Updates

**Problem:** The Soundboard (`/api/public/soundboard`) and Stream (`/api/public/stream`) feeds are cached 30s. New pings/waves are invisible until the next poll or cache expiry.

**Solution:** Broadcast new and deleted pings/waves to the organization room so connected clients can prepend/remove items from their feeds.

**Events:**

| Event          | Room                   | Payload                                            |
| -------------- | ---------------------- | -------------------------------------------------- |
| `ping:created` | `org:{organizationId}` | Sanitized ping object (same shape as GET response) |
| `ping:deleted` | `org:{organizationId}` | `{ pingId }`                                       |
| `wave:created` | `org:{organizationId}` | Wave object (same shape as GET response)           |
| `wave:deleted` | `org:{organizationId}` | `{ waveId }`                                       |

**Controller Changes:**

In `src/controllers/pingController.ts`:

```ts
import { emitPingCreated, emitPingDeleted } from '../utils/socketEmitter';

// In createPing, after successful creation:
emitPingCreated(organizationId!, sanitizedPing);

// In deletePing, after successful deletion:
emitPingDeleted(req.organizationId!, pingIdInt);
```

In `src/controllers/waveController.ts`:

```ts
import { emitWaveCreated, emitWaveDeleted } from '../utils/socketEmitter';

// In createWave, after successful creation:
emitWaveCreated(organizationId!, newWave);

// In deleteWave, after successful deletion:
emitWaveDeleted(req.organizationId!, waveIdInt);
```

**Affected files:**

- `src/controllers/pingController.ts`
- `src/controllers/waveController.ts`

**Client usage:**

```ts
socket.on('ping:created', (ping) => {
  // Prepend to feed list (if matches current filters)
});

socket.on('ping:deleted', ({ pingId }) => {
  // Remove from feed list
});
```

> **Note:** Anonymous pings should have `author` information stripped before emission. The existing `sanitizePing()` function already handles this — use its output as the payload.

---

### 4. Live Comment Threads

**Problem:** Comments are fetched once when viewing a ping/wave detail page. New comments from other users don't appear until the page is refreshed.

**Solution:** When a comment is created, emit it to all users currently viewing that ping or wave (those who have joined the `ping:{id}` or `wave:{id}` room).

**Events:**

| Event             | Room            | Payload                  |
| ----------------- | --------------- | ------------------------ |
| `comment:created` | `ping:{pingId}` | Sanitized comment object |
| `comment:created` | `wave:{waveId}` | Sanitized comment object |

**Controller Changes:**

In `src/controllers/commentController.ts`:

```ts
import { emitCommentOnPing, emitCommentOnWave } from '../utils/socketEmitter';

// In createCommentOnPing, after successful creation:
emitCommentOnPing(pingIdInt, sanitizeComment(newComment));

// In createCommentOnWave, after successful creation:
emitCommentOnWave(waveIdInt, sanitizeComment(newComment));
```

**Affected files:**

- `src/controllers/commentController.ts`

**Client-side room management:**

```ts
// When navigating to a ping detail page:
socket.emit('join:ping', pingId);

// When leaving the page:
socket.emit('leave:ping', pingId);

// Listen for new comments:
socket.on('comment:created', (comment) => {
  // Append to comments list
});
```

> **Note:** The comment author who just posted can ignore the incoming event (they already have the comment from the POST response) by checking `comment.authorId === currentUserId`, or simply deduplicate by `comment.id`.

---

### 6. Announcement Broadcast

**Problem:** Announcements create bulk DB notifications for every org member, but the user only sees them when they next poll the notifications endpoint or refresh the announcements page.

**Solution:** Broadcast the announcement to the entire organization room for instant toast/banner display.

**Events:**

| Event              | Room                   | Payload                  |
| ------------------ | ---------------------- | ------------------------ |
| `announcement:new` | `org:{organizationId}` | Full announcement object |

**Controller Changes:**

In `src/controllers/announcementController.ts`:

```ts
import { emitAnnouncement } from '../utils/socketEmitter';

// In createAnnouncement, after the transaction completes:
emitAnnouncement(organizationId!, newAnnouncement);
```

**Affected files:**

- `src/controllers/announcementController.ts`

**Client usage:**

```ts
socket.on('announcement:new', (announcement) => {
  // Show toast/banner
  // If on announcements page, prepend to list
});
```

> **Note:** The announcement is also delivered as a notification via Feature 1. The `announcement:new` event is for immediate UI display (toast/banner), while `notification:new` updates the notification bell. The client handles both.

---

## Event Reference

Complete list of all WebSocket events in the system:

### Server → Client Events

| Event              | Room                               | Payload                          | Feature |
| ------------------ | ---------------------------------- | -------------------------------- | ------- |
| `notification:new` | `user:{userId}`                    | `Notification` object            | 1       |
| `ping:surgeUpdate` | `org:{orgId}`                      | `{ pingId, surgeCount, surged }` | 2       |
| `wave:surgeUpdate` | `org:{orgId}`                      | `{ waveId, surgeCount, surged }` | 2       |
| `ping:created`     | `org:{orgId}`                      | Sanitized `Ping` object          | 3       |
| `ping:deleted`     | `org:{orgId}`                      | `{ pingId }`                     | 3       |
| `wave:created`     | `org:{orgId}`                      | `Wave` object                    | 3       |
| `wave:deleted`     | `org:{orgId}`                      | `{ waveId }`                     | 3       |
| `comment:created`  | `ping:{pingId}` or `wave:{waveId}` | Sanitized `Comment` object       | 4       |
| `announcement:new` | `org:{orgId}`                      | `Announcement` object            | 6       |

### Client → Server Events

| Event        | Payload          | Purpose                              |
| ------------ | ---------------- | ------------------------------------ |
| `join:ping`  | `pingId: number` | Subscribe to live comments on a ping |
| `leave:ping` | `pingId: number` | Unsubscribe from a ping's comments   |
| `join:wave`  | `waveId: number` | Subscribe to live comments on a wave |
| `leave:wave` | `waveId: number` | Unsubscribe from a wave's comments   |

---

## Client Integration Guide

### Connection Setup

```ts
import { io } from 'socket.io-client';

const socket = io('https://api.echo.example.com', {
  auth: { token: accessToken },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

socket.on('connect', () => {
  console.log('Connected to Echo real-time');
});

socket.on('connect_error', (err) => {
  if (err.message === 'Invalid token') {
    // Token expired — refresh and reconnect
    refreshToken().then((newToken) => {
      socket.auth = { token: newToken };
      socket.connect();
    });
  }
});
```

### Room Lifecycle

The client **does not** need to manually join `user:{userId}` or `org:{organizationId}` — the server joins these automatically on connection.

The client **does** need to manage `ping:{id}` and `wave:{id}` rooms:

```ts
// React example with cleanup
useEffect(() => {
  socket.emit('join:ping', pingId);
  return () => socket.emit('leave:ping', pingId);
}, [pingId]);
```

### Deduplication

Since the client also receives data from REST responses (e.g., after creating a comment), the client should deduplicate by entity ID:

```ts
socket.on('comment:created', (comment) => {
  setComments((prev) => {
    if (prev.some((c) => c.id === comment.id)) return prev;
    return [...prev, comment];
  });
});
```

---

## Testing

### Unit Tests

The `safeEmit` wrapper in `socketEmitter.ts` gracefully handles the case where Socket.IO isn't initialized, so existing controller unit tests continue to work without mocking.

For testing WebSocket behavior specifically:

```ts
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';

describe('WebSocket: notifications', () => {
  let io, clientSocket, httpServer;

  beforeAll((done) => {
    httpServer = createServer();
    io = new Server(httpServer);
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: testJwt },
      });
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
  });

  it('receives notification:new in user room', (done) => {
    clientSocket.on('notification:new', (data) => {
      expect(data.type).toBe('WAVE_APPROVED');
      done();
    });

    // Trigger the emit from server side
    io.to(`user:${testUserId}`).emit('notification:new', {
      type: 'WAVE_APPROVED',
      title: 'Your wave was approved',
    });
  });
});
```

### E2E / Manual Testing

Use the [Socket.IO Admin UI](https://admin.socket.io) or a tool like `wscat` / Postman WebSocket:

```bash
# Connect with auth
wscat -c "ws://localhost:3000/socket.io/?EIO=4&transport=websocket" \
  -H "Authorization: Bearer <jwt>"
```

---

## Files Changed Summary

| File                                        | Change                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/config/socket.ts`                      | **New** — Socket.IO server init, auth middleware, room management                                  |
| `src/utils/socketEmitter.ts`                | **New** — Emit helper functions used by controllers                                                |
| `src/server.ts`                             | **Modified** — Use `http.createServer(app)` instead of `app.listen()`, call `initializeSocketIO()` |
| `src/services/notificationService.ts`       | **Modified** — Add `emitNotification()` calls after creating notifications                         |
| `src/controllers/surgeController.ts`        | **Modified** — Add surge update emissions                                                          |
| `src/controllers/pingController.ts`         | **Modified** — Add ping created/deleted emissions                                                  |
| `src/controllers/waveController.ts`         | **Modified** — Add wave created/deleted emissions                                                  |
| `src/controllers/commentController.ts`      | **Modified** — Add comment created emissions                                                       |
| `src/controllers/announcementController.ts` | **Modified** — Add announcement broadcast emission                                                 |

---

## Security Considerations

1. **Authentication** — Every WebSocket connection is authenticated via JWT in the handshake. Invalid or expired tokens are rejected before the connection is established.
2. **Organization Isolation** — Users can only receive events from their own organization's room. The server auto-joins rooms based on the authenticated user's `organizationId` — clients cannot join arbitrary org rooms.
3. **Room Validation** — `join:ping` and `join:wave` events should validate that the ping/wave belongs to the user's organization before joining the room (prevents cross-tenant data leakage).
4. **Anonymous Content** — Emitted payloads for anonymous pings/comments must strip author info. Use the existing `sanitizePing()` / `sanitizeComment()` functions to produce the payload.
5. **Rate Limiting** — Socket.IO events from clients (room joins) should be rate-limited to prevent abuse. Socket.IO middleware can enforce this.
6. **No Sensitive Data** — Never emit password hashes, tokens, or internal IDs that aren't already exposed via REST.
