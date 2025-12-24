import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestClient } from './appClient.js';
import './setupHooks.js';
import { createOrganization, createUser, createPing, cleanupTestData } from '../fixtures/index.js';

describe('Organization Isolation', () => {
  let org1Client: any;
  let org2Client: any;
  let org1User: any;
  let org2User: any;
  let org1Ping: any;
  let org2Ping: any;
  let org1Token: string;
  let org2Token: string;

  beforeAll(async () => {
    // Create two organizations
    const org1 = await createOrganization({ name: 'Org One', domain: 'org1.edu' });
    const org2 = await createOrganization({ name: 'Org Two', domain: 'org2.edu' });

    // Create users in each org
    org1User = await createUser({
      organizationId: org1.id,
      email: 'user1@org1.edu',
      firstName: 'User',
      lastName: 'One'
    });
    org2User = await createUser({
      organizationId: org2.id,
      email: 'user2@org2.edu',
      firstName: 'User',
      lastName: 'Two'
    });

    // Create pings in each org
    org1Ping = await createPing({
      organizationId: org1.id,
      authorId: org1User.id,
      title: 'Org1 Ping',
      content: 'This is a ping from org1'
    });
    org2Ping = await createPing({
      organizationId: org2.id,
      authorId: org2User.id,
      title: 'Org2 Ping',
      content: 'This is a ping from org2'
    });

    // Create authenticated clients
    org1Client = await buildTestClient({ disableRateLimiting: true });
    org2Client = await buildTestClient({ disableRateLimiting: true });

    // Login both users and store tokens
    const login1Res = await org1Client
      .post('/api/users/login')
      .send({ email: 'user1@org1.edu', password: 'Password123!' });
    expect(login1Res.status).toBe(200);
    org1Token = login1Res.body.token;

    const login2Res = await org2Client
      .post('/api/users/login')
      .send({ email: 'user2@org2.edu', password: 'Password123!' });
    expect(login2Res.status).toBe(200);
    org2Token = login2Res.body.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Ping Access', () => {
    it('should allow org1 user to access org1 pings', async () => {
      const res = await org1Client
        .get('/api/pings')
        .set('Authorization', `Bearer ${org1Token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Should contain org1 ping
      const pingIds = res.body.data.map((p: any) => p.id);
      expect(pingIds).toContain(org1Ping.id);
    });

    it('should allow org2 user to access org2 pings', async () => {
      const res = await org2Client
        .get('/api/pings')
        .set('Authorization', `Bearer ${org2Token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Should contain org2 ping
      const pingIds = res.body.data.map((p: any) => p.id);
      expect(pingIds).toContain(org2Ping.id);
    });

    it('should NOT allow org1 user to access org2 pings', async () => {
      const res = await org1Client
        .get('/api/pings')
        .set('Authorization', `Bearer ${org1Token}`);
      expect(res.status).toBe(200);

      // Should NOT contain org2 ping
      const pingIds = res.body.data.map((p: any) => p.id);
      expect(pingIds).not.toContain(org2Ping.id);
    });

    it('should NOT allow org2 user to access org1 pings', async () => {
      const res = await org2Client
        .get('/api/pings')
        .set('Authorization', `Bearer ${org2Token}`);
      expect(res.status).toBe(200);

      // Should NOT contain org1 ping
      const pingIds = res.body.data.map((p: any) => p.id);
      expect(pingIds).not.toContain(org1Ping.id);
    });

    it('should return 404 when org1 user tries to access specific org2 ping', async () => {
      const res = await org1Client
        .get(`/api/pings/${org2Ping.id}`)
        .set('Authorization', `Bearer ${org1Token}`);
      expect(res.status).toBe(404);
    });

    it('should return 404 when org2 user tries to access specific org1 ping', async () => {
      const res = await org2Client
        .get(`/api/pings/${org1Ping.id}`)
        .set('Authorization', `Bearer ${org2Token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('User Access', () => {
    it('should allow org1 user to access org1 user data', async () => {
      const res = await org1Client
        .get('/api/users/me')
        .set('Authorization', `Bearer ${org1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('user1@org1.edu');
      expect(res.body.organizationId).toBe(org1User.organizationId);
    });

    it('should allow org2 user to access org2 user data', async () => {
      const res = await org2Client
        .get('/api/users/me')
        .set('Authorization', `Bearer ${org2Token}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('user2@org2.edu');
      expect(res.body.organizationId).toBe(org2User.organizationId);
    });
  });
});