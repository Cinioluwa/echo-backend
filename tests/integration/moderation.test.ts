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

describe('Moderation Actions', () => {
  let client: any;
  let org: any;
  let adminUser: any;
  let pingAuthor: any;
  let reporterUser: any;
  let category: any;
  let superAdminUser: any;

  let adminToken = '';
  let authorToken = '';
  let reporterToken = '';
  let pingId = 0;
  let reportId = 0;

  beforeAll(async () => {
    client = await buildTestClient({ disableRateLimiting: true });

    org = await createOrganization({
      name: 'Mod Org',
      domain: 'mod.edu',
    });

    superAdminUser = await createUser({
      email: 'super@echo.com',
      firstName: 'Super',
      lastName: 'Admin',
      organizationId: org.id,
      role: 'SUPER_ADMIN',
    });

    adminUser = await createUser({
      email: 'admin@mod.edu',
      firstName: 'Admin',
      lastName: 'Mod',
      organizationId: org.id,
      role: 'ADMIN',
    });

    pingAuthor = await createUser({
      email: 'author@mod.edu',
      firstName: 'Ping',
      lastName: 'Author',
      organizationId: org.id,
      role: 'USER',
    });

    reporterUser = await createUser({
      email: 'reporter@mod.edu',
      firstName: 'Post',
      lastName: 'Reporter',
      organizationId: org.id,
      role: 'USER',
    });

    category = await createCategory({
      name: 'Mod Category',
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

    // Login users
    const adminLogin = await client
      .post('/api/users/login')
      .send({ email: adminUser.email, password: 'Password123!' })
      .expect(200);
    adminToken = adminLogin.body.token;

    const authorLogin = await client
      .post('/api/users/login')
      .send({ email: pingAuthor.email, password: 'Password123!' })
      .expect(200);
    authorToken = authorLogin.body.token;

    const reporterLogin = await client
      .post('/api/users/login')
      .send({ email: reporterUser.email, password: 'Password123!' })
      .expect(200);
    reporterToken = reporterLogin.body.token;

    // Create initial report
    const res = await client
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({ pingId, reason: 'Test report' })
      .expect(201);
    reportId = res.body.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('allows admins to warn an author', async () => {
    const res = await client
      .post(`/api/admin/reports/${reportId}/action`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'WARN',
        note: 'Please review guidelines.',
      })
      .expect(200);

    expect(res.body.action).toBe('WARN');
    expect(res.body.status).toBe('REVIEWED');
  });

  it('allows admins to request identity disclosure', async () => {
    // Create a new ping to report (to avoid duplicate pending report conflict)
    const newPing = await createPing({
      title: 'Reported ping 2',
      content: 'Reported ping content 2',
      categoryId: category.id,
      organizationId: org.id,
      authorId: pingAuthor.id,
    });
    
    // Create a new report
    const reportRes = await client
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({ pingId: newPing.id, reason: 'Test report 2' })
      .expect(201);

    const res = await client
      .post(`/api/admin/reports/${reportRes.body.id}/action`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'REQUEST_IDENTITY_DISCLOSURE',
        note: 'This is a detailed justification of at least 50 characters to explain why we need identity disclosure for this user.',
      })
      .expect(200);

    expect(res.body.action).toBe('REQUEST_IDENTITY_DISCLOSURE');
    expect(res.body.status).toBe('REVIEWED');
  });

  it('allows admins to suspend an author', async () => {
    const newPing = await createPing({
      title: 'Reported ping 3',
      content: 'Reported ping content 3',
      categoryId: category.id,
      organizationId: org.id,
      authorId: pingAuthor.id,
    });
    
    // Create a new report
    const reportRes = await client
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({ pingId: newPing.id, reason: 'Test report 3' })
      .expect(201);

    const res = await client
      .post(`/api/admin/reports/${reportRes.body.id}/action`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'SUSPEND',
        suspendPreset: '1_DAY',
        note: 'Temporary suspension.',
      })
      .expect(200);

    expect(res.body.action).toBe('SUSPEND');
    expect(res.body.status).toBe('RESOLVED');
  });

  it('blocks suspended users from posting new content', async () => {
    const res = await client
      .post('/api/pings')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'I am suspended',
        content: 'But I want to post anyway',
        categoryId: category.id,
      })
      .expect(403);
    
    expect(res.body.error).toContain('Your posting privileges are temporarily restricted');
  });
});
