import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestClient } from './appClient.js';
import './setupHooks.js';
import {
  createOrganization,
  createUser,
  createCategory,
  createPing,
  createComment,
  cleanupTestData,
} from '../fixtures/index.js';
import { getPrisma } from './testContainer.js';

describe('Admin Overview Endpoints', () => {
  let client: any;
  let org1: any;
  let org2: any;
  let emptyOrg: any;
  let admin1: any;
  let admin2: any;
  let emptyOrgAdmin: any;
  let user1: any;
  let regularUser: any;
  let category1: any;
  let category2: any;
  let adminToken: string;
  let otherAdminToken: string;
  let regularToken: string;
  let emptyOrgAdminToken: string;

  beforeAll(async () => {
    client = await buildTestClient({ disableRateLimiting: true });

    org1 = await createOrganization({ name: 'Overview Org 1', domain: 'overview1.edu' });
    org2 = await createOrganization({ name: 'Overview Org 2', domain: 'overview2.edu' });
    emptyOrg = await createOrganization({ name: 'Overview Empty Org', domain: 'overview-empty.edu' });

    admin1 = await createUser({
      email: 'admin-overview@overview1.edu',
      firstName: 'Admin',
      lastName: 'OverviewOne',
      organizationId: org1.id,
      role: 'ADMIN',
    });

    admin2 = await createUser({
      email: 'admin-overview@overview2.edu',
      firstName: 'Admin',
      lastName: 'OverviewTwo',
      organizationId: org2.id,
      role: 'ADMIN',
    });

    emptyOrgAdmin = await createUser({
      email: 'admin-overview@overview-empty.edu',
      firstName: 'Admin',
      lastName: 'OverviewEmpty',
      organizationId: emptyOrg.id,
      role: 'ADMIN',
    });

    regularUser = await createUser({
      email: 'user-overview@overview1.edu',
      firstName: 'Regular',
      lastName: 'OverviewUser',
      organizationId: org1.id,
      role: 'USER',
    });

    user1 = await createUser({
      email: 'contributor@overview1.edu',
      firstName: 'Top',
      lastName: 'Contributor',
      organizationId: org1.id,
      role: 'USER',
    });

    category1 = await createCategory({ name: 'General', organizationId: org1.id });
    category2 = await createCategory({ name: 'Hall', organizationId: org1.id });

    const pingA = await createPing({
      title: 'WiFi is unstable in lecture rooms',
      content: 'This issue has become constant lately',
      categoryId: category1.id,
      organizationId: org1.id,
      authorId: user1.id,
    });

    const pingB = await createPing({
      title: 'No water in hostel wing B',
      content: 'Water pressure has dropped for two days',
      categoryId: category2.id,
      organizationId: org1.id,
      authorId: regularUser.id,
    });

    await createComment({
      pingId: pingA.id,
      organizationId: org1.id,
      authorId: regularUser.id,
      content: 'Great improvement this week, thank you!',
    });

    await createComment({
      pingId: pingB.id,
      organizationId: org1.id,
      authorId: user1.id,
      content: 'This is terrible and frustrating.',
    });

    const prisma = getPrisma();

    await prisma.surge.createMany({
      data: [
        { organizationId: org1.id, userId: user1.id, pingId: pingA.id },
        { organizationId: org1.id, userId: user1.id, pingId: pingA.id },
        { organizationId: org1.id, userId: user1.id, pingId: pingA.id },
        { organizationId: org1.id, userId: regularUser.id, pingId: pingB.id },
      ],
    });

    const org2Category = await createCategory({ name: 'External', organizationId: org2.id });
    const org2Ping = await createPing({
      title: 'External org ping',
      content: 'Other organization data should be isolated',
      categoryId: org2Category.id,
      organizationId: org2.id,
      authorId: admin2.id,
    });

    await prisma.surge.createMany({
      data: [
        { organizationId: org2.id, userId: admin2.id, pingId: org2Ping.id },
        { organizationId: org2.id, userId: admin2.id, pingId: org2Ping.id },
      ],
    });

    const adminLogin = await client
      .post('/api/users/login')
      .send({ email: admin1.email, password: 'Password123!' })
      .expect(200);
    adminToken = adminLogin.body.token;

    const otherAdminLogin = await client
      .post('/api/users/login')
      .send({ email: admin2.email, password: 'Password123!' })
      .expect(200);
    otherAdminToken = otherAdminLogin.body.token;

    const regularLogin = await client
      .post('/api/users/login')
      .send({ email: regularUser.email, password: 'Password123!' })
      .expect(200);
    regularToken = regularLogin.body.token;

    const emptyOrgAdminLogin = await client
      .post('/api/users/login')
      .send({ email: emptyOrgAdmin.email, password: 'Password123!' })
      .expect(200);
    emptyOrgAdminToken = emptyOrgAdminLogin.body.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('returns dashboard payload for admin overview', async () => {
    const res = await client
      .get('/api/admin/overview?months=6&topPingsLimit=3&oldestLimit=3&unresolvedDays=7')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('period');
    expect(res.body).toHaveProperty('summaryCards');
    expect(res.body).toHaveProperty('communityActivity');
    expect(res.body).toHaveProperty('categoryHealth');
    expect(res.body).toHaveProperty('topPings');
    expect(res.body).toHaveProperty('oldestUnresolved');

    expect(res.body.summaryCards).toHaveProperty('waves');
    expect(res.body.summaryCards).toHaveProperty('pingsSubmitted');
    expect(res.body.summaryCards).toHaveProperty('resolutionRate');
    expect(res.body.summaryCards).toHaveProperty('avgResolveTimeDays');
    expect(Array.isArray(res.body.communityActivity.series)).toBe(true);
    expect(Array.isArray(res.body.categoryHealth)).toBe(true);
    expect(Array.isArray(res.body.topPings.items)).toBe(true);
    expect(Array.isArray(res.body.oldestUnresolved.items)).toBe(true);
  });

  it('returns surging issues and supports empty windows', async () => {
    const liveWindow = await client
      .get('/api/admin/overview/surging-issues?hours=12&minEvents=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(liveWindow.body).toHaveProperty('count');
    expect(liveWindow.body).toHaveProperty('items');
    expect(Array.isArray(liveWindow.body.items)).toBe(true);
    expect(liveWindow.body.count).toBeGreaterThan(0);

    const emptyWindow = await client
      .get('/api/admin/overview/surging-issues?hours=1&offsetHours=200&minEvents=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(emptyWindow.body.count).toBe(0);
    expect(emptyWindow.body.items).toEqual([]);
  });

  it('returns top contributors and keeps organization isolation', async () => {
    const org1Res = await client
      .get('/api/admin/overview/top-contributors?days=30&limit=5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(org1Res.body.items)).toBe(true);
    expect(org1Res.body.items.length).toBeGreaterThan(0);
    expect(org1Res.body.items[0]).toHaveProperty('rank');
    expect(org1Res.body.items[0]).toHaveProperty('wavesCast');

    const topNamesOrg1 = org1Res.body.items.map((item: any) => item.name);
    expect(topNamesOrg1).not.toContain('Admin OverviewTwo');

    const org2Res = await client
      .get('/api/admin/overview/top-contributors?days=30&limit=5')
      .set('Authorization', `Bearer ${otherAdminToken}`)
      .expect(200);

    const topNamesOrg2 = org2Res.body.items.map((item: any) => item.name);
    expect(topNamesOrg2.some((name: string) => name.includes('OverviewTwo'))).toBe(true);
    expect(topNamesOrg2.some((name: string) => name.includes('OverviewOne'))).toBe(false);
  });

  it('returns community mood trend and supports empty datasets', async () => {
    const withData = await client
      .get('/api/admin/overview/community-mood?days=30')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(withData.body).toHaveProperty('totals');
    expect(withData.body).toHaveProperty('percentages');
    expect(withData.body).toHaveProperty('trend');
    expect(Array.isArray(withData.body.trend)).toBe(true);
    expect(withData.body.trend.length).toBe(30);

    const emptyData = await client
      .get('/api/admin/overview/community-mood?days=7')
      .set('Authorization', `Bearer ${emptyOrgAdminToken}`)
      .expect(200);

    expect(emptyData.body.totals.comments).toBe(0);
    expect(emptyData.body.percentages.positive).toBe(0);
    expect(emptyData.body.percentages.neutral).toBe(0);
    expect(emptyData.body.percentages.negative).toBe(0);
    expect(emptyData.body.trend.length).toBe(7);
  });

  it('rejects non-admin access to overview endpoints', async () => {
    const endpoints = [
      '/api/admin/overview',
      '/api/admin/overview/surging-issues',
      '/api/admin/overview/top-contributors',
      '/api/admin/overview/community-mood',
    ];

    for (const endpoint of endpoints) {
      await client
        .get(endpoint)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    }
  });

  it('requires authentication for overview endpoint', async () => {
    await client
      .get('/api/admin/overview')
      .expect(401);
  });
});
