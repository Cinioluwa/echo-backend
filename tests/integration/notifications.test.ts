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

describe('Notifications', () => {
  let client: any;
  let org: any;
  let adminUser: any;
  let representativeUser: any;
  let pingAuthor: any;
  let category: any;
  let adminToken: string;
  let repToken: string;
  let authorToken: string;

  beforeAll(async () => {
    client = await buildTestClient({ disableRateLimiting: true });

    org = await createOrganization({ name: 'Notif Org', domain: 'notif.edu' });

    adminUser = await createUser({
      email: 'admin@notif.edu',
      firstName: 'Admin',
      lastName: 'User',
      organizationId: org.id,
      role: 'ADMIN',
    });

    representativeUser = await createUser({
      email: 'rep@notif.edu',
      firstName: 'Rep',
      lastName: 'User',
      organizationId: org.id,
      role: 'REPRESENTATIVE',
    });

    pingAuthor = await createUser({
      email: 'author@notif.edu',
      firstName: 'Author',
      lastName: 'User',
      organizationId: org.id,
      role: 'USER',
    });

    category = await createCategory({ name: 'Notif Category', organizationId: org.id });

    const adminLogin = await client
      .post('/api/users/login')
      .send({ email: adminUser.email, password: 'Password123!' })
      .expect(200);
    adminToken = adminLogin.body.token;

    const repLogin = await client
      .post('/api/users/login')
      .send({ email: representativeUser.email, password: 'Password123!' })
      .expect(200);
    repToken = repLogin.body.token;

    const authorLogin = await client
      .post('/api/users/login')
      .send({ email: pingAuthor.email, password: 'Password123!' })
      .expect(200);
    authorToken = authorLogin.body.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('should create a notification when a wave is approved (ping author)', async () => {
    const ping = await createPing({
      title: 'Notif Ping',
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

    const res = await client
      .get('/api/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    const row = res.body.data.find((n: any) => n.type === 'WAVE_APPROVED' && n.pingId === ping.id);
    expect(row).toBeDefined();
    expect(row.readAt).toBeNull();

    const countRes = await client
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200);

    expect(typeof countRes.body.unreadCount).toBe('number');
    expect(countRes.body.unreadCount).toBeGreaterThan(0);

    const readRes = await client
      .patch(`/api/notifications/${row.id}/read`)
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200);

    expect(readRes.body.readAt).toBeTruthy();
  });

  it('should create a notification when an official response is posted (ping author)', async () => {
    const ping = await createPing({
      title: 'Ping with official response',
      content: 'Ping content',
      categoryId: category.id,
      organizationId: org.id,
      authorId: pingAuthor.id,
    });

    await client
      .post(`/api/pings/${ping.id}/official-response`)
      .set('Authorization', `Bearer ${repToken}`)
      .send({ content: 'Official response content', isResolved: false })
      .expect(201);

    const res = await client
      .get('/api/notifications')
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200);

    const row = res.body.data.find(
      (n: any) => n.type === 'OFFICIAL_RESPONSE_POSTED' && n.pingId === ping.id
    );
    expect(row).toBeDefined();
  });

  it('should create announcement notifications for org users (excluding author)', async () => {
    const res = await client
      .post('/api/admin/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Notif Announcement',
        content: 'Announcement content',
        categoryIds: [category.id],
      })
      .expect(201);

    const announcementId = res.body.id;

    const notifRes = await client
      .get('/api/notifications')
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200);

    const row = notifRes.body.data.find(
      (n: any) => n.type === 'ANNOUNCEMENT_POSTED' && n.announcementId === announcementId
    );
    expect(row).toBeDefined();
  });
});
