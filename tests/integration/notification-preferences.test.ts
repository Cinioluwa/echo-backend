import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestClient } from './appClient.js';
import './setupHooks.js';
import {
  createUser,
  createOrganization,
  createCategory,
  createPing,
  createWave,
  cleanupTestData,
} from '../fixtures/index.js';

describe('Notification Preferences', () => {
  let client: any;
  let org: any;
  let adminToken: string;
  let authorToken: string;
  let category: any;
  let pingAuthor: any;

  beforeAll(async () => {
    client = await buildTestClient({ disableRateLimiting: true });

    org = await createOrganization({ name: 'Notif Pref Org', domain: 'notifpref.edu' });
    category = await createCategory({ name: 'Notif Pref Category', organizationId: org.id });

    await createUser({
      email: 'admin@notifpref.edu',
      firstName: 'Admin',
      lastName: 'User',
      organizationId: org.id,
      role: 'ADMIN',
    });

    pingAuthor = await createUser({
      email: 'author@notifpref.edu',
      firstName: 'Author',
      lastName: 'User',
      organizationId: org.id,
      role: 'USER',
    });

    const adminLogin = await client
      .post('/api/users/login')
      .send({ email: 'admin@notifpref.edu', password: 'Password123!' })
      .expect(200);
    adminToken = adminLogin.body.token;

    const authorLogin = await client
      .post('/api/users/login')
      .send({ email: 'author@notifpref.edu', password: 'Password123!' })
      .expect(200);
    authorToken = authorLogin.body.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('returns defaults when preferences do not exist', async () => {
    const res = await client
      .get('/api/users/me/notification-preferences')
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      waveStatusUpdated: true,
      officialResponse: true,
      announcement: true,
      commentSurge: true,
      pingCreated: true,
    });
  });

  it('allows partial updates via PATCH', async () => {
    const res = await client
      .patch('/api/users/me/notification-preferences')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ waveStatusUpdated: false })
      .expect(200);

    expect(res.body.waveStatusUpdated).toBe(false);

    const getRes = await client
      .get('/api/users/me/notification-preferences')
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200);

    expect(getRes.body.waveStatusUpdated).toBe(false);
  });

  it('does not create wave-status notifications when opted out', async () => {
    // Ensure opted out
    await client
      .patch('/api/users/me/notification-preferences')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ waveStatusUpdated: false })
      .expect(200);

    const ping = await createPing({
      title: 'Pref Ping',
      content: 'Ping content',
      categoryId: category.id,
      organizationId: org.id,
      authorId: pingAuthor.id,
    });

    const wave = await createWave({
      pingId: ping.id,
      organizationId: org.id,
      solution: 'Wave solution',
    });

    await client
      .patch(`/api/admin/waves/${wave.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);

    const notifRes = await client
      .get('/api/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200);

    const row = notifRes.body.data.find(
      (n: any) =>
        (n.type === 'WAVE_APPROVED' || n.type === 'WAVE_STATUS_UPDATED') && n.pingId === ping.id
    );
    expect(row).toBeUndefined();
  });
});

