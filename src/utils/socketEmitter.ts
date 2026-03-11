// src/utils/socketEmitter.ts
import { getIO } from '../config/socket.js';

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

export function emitCommentSurgeUpdate(
  organizationId: number,
  data: { commentId: number; surgeCount: number; surged: boolean }
): void {
  safeEmit(`org:${organizationId}`, 'comment:surgeUpdate', data);
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
