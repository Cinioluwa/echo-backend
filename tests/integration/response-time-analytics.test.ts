import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestClient } from './appClient.js';
import './setupHooks.js';
import {
  createOrganization,
  createUser,
  createCategory,
  createPing,
  cleanupTestData,
} from '../fixtures/index.js';

// Keep assertions loose on timing: we only care that timestamps set and analytics shape is correct.

describe('Response time tracking (Ping)', () => {
  let client: any;
  let org: any;
  let adminUser: any;
  let regularUser: any;
  let category: any;
  let adminToken: string;

  beforeAll(async () => {
    client = await buildTestClient({ disableRateLimiting: true });

    org = await createOrganization({ name: 'RespTime Org', domain: 'resptime.edu' });

    adminUser = await createUser({
      organizationId: org.id,
      email: 'admin@resptime.edu',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    });

    regularUser = await createUser({
      organizationId: org.id,
      email: 'user@resptime.edu',
      firstName: 'Regular',
      lastName: 'User',
      role: 'USER',
    });

    category = await createCategory({ organizationId: org.id, name: 'Facilities' });

    const login = await client
      .post('/api/users/login')
      .send({ email: adminUser.email, password: 'Password123!' })
      .expect(200);

    adminToken = login.body.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('acknowledges a ping idempotently', async () => {
    const ping = await createPing({
      title: 'Broken light',
      content: 'The hallway light is broken',
      categoryId: category.id,
      organizationId: org.id,
      authorId: regularUser.id,
    });

    const res1 = await client
      .post(`/api/admin/pings/${ping.id}/acknowledge`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res1.body).toHaveProperty('acknowledgedAt');
    expect(res1.body.acknowledgedAt).toBeTruthy();

    const firstAck = res1.body.acknowledgedAt;

    const res2 = await client
      .post(`/api/admin/pings/${ping.id}/acknowledge`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res2.body.acknowledgedAt).toBe(firstAck);
  });

  it('resolves a ping and returns response-time analytics', async () => {
    const ping = await createPing({
      title: 'Water issue',
      content: 'No water in my hostel',
      categoryId: category.id,
      organizationId: org.id,
      authorId: regularUser.id,
    });

    const resolved = await client
      .post(`/api/admin/pings/${ping.id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(resolved.body).toHaveProperty('resolvedAt');
    expect(resolved.body.resolvedAt).toBeTruthy();
    expect(resolved.body.progressStatus).toBe('RESOLVED');

    const analytics = await client
      .get('/api/admin/analytics/response-times?days=30')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(analytics.body).toHaveProperty('windowDays');
    expect(analytics.body).toHaveProperty('totalPings');
    expect(analytics.body).toHaveProperty('byCategory');
    expect(Array.isArray(analytics.body.byCategory)).toBe(true);

    const catRow = analytics.body.byCategory.find((r: any) => r.categoryId === category.id);
    expect(catRow).toBeDefined();
    expect(catRow).toHaveProperty('avgMsToResolve');
  });
});
