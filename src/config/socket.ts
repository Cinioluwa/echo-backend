// src/config/socket.ts
import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type { RedisClientType } from './redis.js';
import { buildRedisClient } from './redis.js';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import prisma from './db.js';
import logger from './logger.js';
import { env } from './env.js';

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export async function initializeSocketIO(
  httpServer: HttpServer,
  redisClient: RedisClientType | null
): Promise<SocketIOServer> {
  const allowedOrigins = env.ALLOWED_ORIGINS || [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://echo-ng.com',
    'https://www.echo-ng.com',
    'https://tryecho.online',
    'https://webapp-echo.vercel.app'
  ];

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ─── Redis Adapter ───
  // Upstash does NOT support client.duplicate().
  // We build two independent clients from the same URL instead.
  if (redisClient) {
    const pubClient = buildRedisClient();
    const subClient = buildRedisClient();
    pubClient.on('error', (err: Error) => logger.warn('Redis pub error', { error: err.message }));
    subClient.on('error', (err: Error) => logger.warn('Redis sub error', { error: err.message }));
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO initialized with Redis adapter');
  } else {
    logger.warn('Socket.IO initialized WITHOUT Redis adapter');
  }

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

  return io;
}
