import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestClient } from './appClient.js';
import './setupHooks.js';
import {
  cleanupTestData,
  createCategory,
  createOrganization,
  createPing,
  createUser,
} from '../fixtures/index.js';

describe('Post Reporting', () => {
  let client: any;
  let org: any;
  let adminUser: any;
  let pingAuthor: any;
  let reporterUser: any;
  let category: any;

  let adminToken = '';
  let reporterToken = '';
  let pingId = 0;
  let reportId = 0;

  beforeAll(async () => {
    client = await buildTestClient({ disableRateLimiting: true });

    org = await createOrganization({
      name: 'Report Org',
      domain: 'reports.edu',
    });

    adminUser = await createUser({
      email: 'admin@reports.edu',
      firstName: 'Admin',
      lastName: 'Reporter',
      organizationId: org.id,
      role: 'ADMIN',
    });

    pingAuthor = await createUser({
      email: 'author@reports.edu',
      firstName: 'Ping',
      lastName: 'Author',
      organizationId: org.id,
      role: 'USER',
    });

    reporterUser = await createUser({
      email: 'reporter@reports.edu',
      firstName: 'Post',
      lastName: 'Reporter',
      organizationId: org.id,
      role: 'USER',
    });

    category = await createCategory({
      name: 'Reports Category',
      organizationId: org.id,
    });

    const ping = await createPing({
      title: 'Reported ping title',
      content: 'Reported ping content',
      categoryId: category.id,
      organizationId: org.id,
      authorId: pingAuthor.id,
    });
    pingId = ping.id;

    const adminLogin = await client
      .post('/api/users/login')
      .send({ email: adminUser.email, password: 'Password123!' })
      .expect(200);
    adminToken = adminLogin.body.token;

    const reporterLogin = await client
      .post('/api/users/login')
      .send({ email: reporterUser.email, password: 'Password123!' })
      .expect(200);
    reporterToken = reporterLogin.body.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('creates a report on a ping and notifies admins', async () => {
    const res = await client
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({
        pingId,
        reason: 'This post contains abusive content.',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('PENDING');
    expect(res.body.pingId).toBe(pingId);
    reportId = res.body.id;

    const adminNotifs = await client
      .get('/api/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const reportNotif = adminNotifs.body.data.find(
      (n: any) => n.type === 'POST_REPORTED' && n.pingId === pingId,
    );

    expect(reportNotif).toBeDefined();
  });

  it('prevents duplicate pending report for same reporter and target', async () => {
    const res = await client
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({
        pingId,
        reason: 'Still inappropriate',
      })
      .expect(409);

    expect(res.body.error).toContain('pending report');
  });

  it('blocks non-admin users from listing reports', async () => {
    await client
      .get('/api/reports')
      .set('Authorization', `Bearer ${reporterToken}`)
      .expect(403);
  });

  it('allows admins to list reports', async () => {
    const res = await client
      .get('/api/reports?status=PENDING&page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();

    const listed = res.body.data.find((r: any) => r.id === reportId);
    expect(listed).toBeDefined();
  });

  it('allows admins to update report status and notifies reporter', async () => {
    const update = await client
      .patch(`/api/reports/${reportId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'RESOLVED' })
      .expect(200);

    expect(update.body.status).toBe('RESOLVED');

    const reporterNotifs = await client
      .get('/api/notifications')
      .set('Authorization', `Bearer ${reporterToken}`)
      .expect(200);

    const reporterUpdate = reporterNotifs.body.data.find(
      (n: any) =>
        n.type === 'POST_REPORTED' &&
        n.pingId === pingId &&
        typeof n.body === 'string' &&
        n.body.includes('resolved'),
    );

    expect(reporterUpdate).toBeDefined();
  });
});
