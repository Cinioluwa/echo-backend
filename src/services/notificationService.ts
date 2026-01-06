import type { NotificationType } from '@prisma/client';

type PrismaLike = {
  notification: {
    create: (args: any) => Promise<any>;
    createMany: (args: any) => Promise<any>;
  };
  user?: {
    findMany: (args: any) => Promise<any[]>;
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
};

export const createNotification = async (db: PrismaLike, input: CreateNotificationInput) => {
  return db.notification.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId,
      type: input.type,
      title: input.title,
      body: input.body,
      pingId: input.pingId,
      waveId: input.waveId,
      announcementId: input.announcementId,
    },
  });
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
    select: { id: true },
  });

  if (!users.length) {
    return { count: 0 };
  }

  return db.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      organizationId: params.organizationId,
      type: 'ANNOUNCEMENT_POSTED',
      title: params.title,
      body: params.body,
      announcementId: params.announcementId,
    })),
  });
};
