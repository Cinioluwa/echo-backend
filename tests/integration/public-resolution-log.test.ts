import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestClient } from './appClient.js';
import './setupHooks.js';
import { createOrganization, createUser, createCategory, createPing, createWave, cleanupTestData } from '../fixtures/index.js';

describe('Public Resolution Log', () => {
  let client: Awaited<ReturnType<typeof buildTestClient>>;
  let userToken: string;
  let adminToken: string;
  let pingId: number;
  let approvedWaveSolution: string;

  beforeAll(async () => {
    client = await buildTestClient();

    const org = await createOrganization({ name: 'Resolution Log Org', domain: 'reslog.edu' });
    const category = await createCategory({ organizationId: org.id, name: 'Facilities' });

    await createUser({
      organizationId: org.id,
      email: 'admin@reslog.edu',
      role: 'ADMIN' as any,
    });

    const user = await createUser({
      organizationId: org.id,
      email: 'user@reslog.edu',
      role: 'USER' as any,
    });

    const ping = await createPing({
      organizationId: org.id,
      authorId: user.id,
      categoryId: category.id,
      title: 'Broken dorm AC',
      content: 'AC has been down for 3 days',
    });
    pingId = ping.id;

    const wave = await createWave({
      organizationId: org.id,
      pingId: ping.id,
      solution: 'Replace compressor and refill coolant',
    });
    approvedWaveSolution = wave.solution;

    const loginUserRes = await client
      .post('/api/users/login')
      .send({ email: 'user@reslog.edu', password: 'Password123!' })
      .expect(200);
    userToken = loginUserRes.body.token;

    const loginAdminRes = await client
      .post('/api/users/login')
      .send({ email: 'admin@reslog.edu', password: 'Password123!' })
      .expect(200);
    adminToken = loginAdminRes.body.token;

    await client
      .patch(`/api/admin/waves/${wave.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('returns resolved pings with approved wave info', async () => {
    const res = await client
      .get('/api/public/resolution-log?days=all&page=1&limit=20')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);

    const row = res.body.data.find((x: any) => x.id === pingId);
    expect(row).toBeTruthy();
    expect(row.title).toBe('Broken dorm AC');
    expect(row.resolvedAt).toBeTruthy();
    expect(row.msToResolve).toBeTypeOf('number');

    expect(row.approvedWave).toBeTruthy();
    expect(row.approvedWave.solution).toBe(approvedWaveSolution);
  });

  it('supports top=N shortcut', async () => {
    const res = await client
      .get('/api/public/resolution-log?top=1')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(res.body.pagination.top).toBe(1);
    expect(res.body.data.length).toBe(1);
  });
});
