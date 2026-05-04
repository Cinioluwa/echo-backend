import type { NotificationType } from '@prisma/client';
import { emitNotification } from '../utils/socketEmitter.js';
import { sendPushNotification } from './pushNotificationService.js';

type PrismaLike = {
  notification: {
    create: (args: any) => Promise<any>;
    createMany: (args: any) => Promise<any>;
  };
  user?: {
    findMany: (args: any) => Promise<any[]>;
  };
  notificationPreference?: {
    findUnique: (args: any) => Promise<any | null>;
    upsert: (args: any) => Promise<any>;
  };
  wave?: {
    findUnique: (args: any) => Promise<any | null>;
  };
};

export type CreateNotificationInput = {
  userId: number;
  organizationId: number;
  type: NotificationType;
  title: string;
  body: string;
  pingId?: number;
  waveId?: number;
  announcementId?: number;
  commentId?: number;
};

export function computeNotificationUrl(notification: { 
  pingId?: number | null; 
  waveId?: number | null; 
  announcementId?: number | null; 
}): string {
  if (notification.pingId) {
    return `/feed/${notification.pingId}`;
  }
  // Note: For waveId only, we might still want the pingId but we'd need a DB lookup.
  // In the REST API response, we might not want to do N lookups.
  // However, in createNotification we do a lookup if needed.
  return '/notifications';
}

const DEFAULT_PREFERENCES = {
  waveStatusUpdated: true,
  officialResponse: true,
  announcement: true,
  commentSurge: true,
  pingCreated: true,
  commentReply: true,
  newWaveOnPing: true,
  newCommentOnPost: true,
  pingSurgedMilestone: true,
} as const;

const isAllowedByPreferences = async (db: PrismaLike, input: CreateNotificationInput): Promise<boolean> => {
  if (!db.notificationPreference) return true;

  const prefs = await db.notificationPreference.upsert({
    where: { userId: input.userId },
    update: {},
    create: { userId: input.userId, ...DEFAULT_PREFERENCES },
  });

  switch (input.type) {
    case 'WAVE_APPROVED':
    case 'WAVE_STATUS_UPDATED':
      return Boolean(prefs.waveStatusUpdated);
    case 'OFFICIAL_RESPONSE_POSTED':
      return Boolean(prefs.officialResponse);
    case 'ANNOUNCEMENT_POSTED':
      return Boolean(prefs.announcement);
    case 'NEW_WAVE_ON_PING':
      return Boolean(prefs.newWaveOnPing);
    case 'NEW_COMMENT_ON_POST':
      return Boolean(prefs.newCommentOnPost);
    case 'PING_SURGED_MILESTONE':
      return Boolean(prefs.pingSurgedMilestone);
    case 'COMMENT_REPLY':
      return Boolean(prefs.commentReply);
    default:
      return true;
  }
};

export const createNotification = async (db: PrismaLike, input: CreateNotificationInput): Promise<any | null> => {
  const allowed = await isAllowedByPreferences(db, input);
  if (!allowed) return null;

  const notification = await db.notification.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId,
      type: input.type,
      title: input.title,
      body: input.body,
      pingId: input.pingId,
      waveId: input.waveId,
      announcementId: input.announcementId,
      commentId: input.commentId,
    },
  });

  // Compute the deep-link URL
  let targetPingId = input.pingId;
  
  // If we have a waveId but no pingId, try to find the pingId via the wave
  if (!targetPingId && input.waveId && db.wave) {
    try {
      const wave = await db.wave.findUnique({
        where: { id: input.waveId },
        select: { pingId: true }
      });
      if (wave) targetPingId = wave.pingId;
    } catch (err) {
      // Silently fail lookup, fallback to root or notifications
    }
  }

  const url = targetPingId ? `/feed/${targetPingId}` : computeNotificationUrl(notification);

  const enrichedPayload = {
    ...notification,
    url
  };

  emitNotification(input.userId, enrichedPayload);

  sendPushNotification(input.userId, {
    title: input.title,
    body: input.body,
    url: url,
  }).catch(() => {});

  return notification;
};

export const createAnnouncementNotificationsForOrg = async (
  db: PrismaLike,
  params: {
    organizationId: number;
    announcementId: number;
    title: string;
    body: string;
    excludeUserId?: number;
  }
) => {
  if (!db.user) {
    throw new Error('createAnnouncementNotificationsForOrg requires a prisma client with user.findMany');
  }

  const users = await db.user.findMany({
    where: {
      organizationId: params.organizationId,
      ...(params.excludeUserId ? { id: { not: params.excludeUserId } } : {}),
    },
    select: {
      id: true,
      notificationPreference: db.notificationPreference
        ? { select: { announcement: true } }
        : undefined,
    },
  });

  if (!users.length) {
    return { count: 0 };
  }

  const recipients = users
    .filter((u) => u.notificationPreference?.announcement !== false)
    .map((u) => u.id);

  if (!recipients.length) {
    return { count: 0 };
  }

  return db.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      organizationId: params.organizationId,
      type: 'ANNOUNCEMENT_POSTED',
      title: params.title,
      body: params.body,
      announcementId: params.announcementId,
    })),
  });
};
