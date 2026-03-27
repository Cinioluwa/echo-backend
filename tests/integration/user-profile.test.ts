import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestClient } from './appClient.js';
import './setupHooks.js';
import { createOrganization, createUser, createPing, createWave, cleanupTestData } from '../fixtures/index.js';

describe('User Profile and Display Name Operations', () => {
  let client: any;
  let org1: any;
  let user1: any, user2: any;
  let user1Token: string, user2Token: string;

  beforeAll(async () => {
    client = await buildTestClient({ disableRateLimiting: true });

    org1 = await createOrganization({ name: 'Org One', domain: 'org1.edu' });

    user1 = await createUser({
      organizationId: org1.id,
      email: 'user1@org1.edu',
      firstName: 'Original',
      lastName: 'Name'
    });

    user2 = await createUser({
      organizationId: org1.id,
      email: 'user2@org1.edu',
      firstName: 'Other',
      lastName: 'Person'
    });

    const login1Res = await client
      .post('/api/users/login')
      .send({ email: 'user1@org1.edu', password: 'Password123!' })
      .expect(200);
    user1Token = login1Res.body.token;

    const login2Res = await client
      .post('/api/users/login')
      .send({ email: 'user2@org1.edu', password: 'Password123!' })
      .expect(200);
    user2Token = login2Res.body.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('GET /api/users/me', () => {
    it('should return the current user with displayName fields', async () => {
      const res = await client
        .get('/api/users/me')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(res.body).toHaveProperty('displayName');
      expect(res.body).toHaveProperty('displayNameHistories');
      expect(res.body.displayName).toBeNull();
    });
  });

  describe('PATCH /api/users/me (DisplayName Mutation)', () => {
    it('should set a new display name successfully', async () => {
      const res = await client
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ displayName: 'NewHandle' })
        .expect(200);

      expect(res.body.user.displayName).toBe('NewHandle');
    });

    it('should allow immediate correction within grace period (15 mins)', async () => {
      const res = await client
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ displayName: 'CorrectedHandle' })
        .expect(200);

      expect(res.body.user.displayName).toBe('CorrectedHandle');
    });

    it('should block reserved keywords', async () => {
      const res = await client
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ displayName: 'Admin' })
        .expect(400);

      expect(res.body.code).toBe('DISPLAY_NAME_RESERVED');
    });

    it('should block reserved keywords with leet-speak obfuscation', async () => {
      const res = await client
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ displayName: 'Adm1n' })
        .expect(400);

      expect(res.body.code).toBe('DISPLAY_NAME_RESERVED');
    });
  });

  describe('GET /api/users/:id/profile', () => {
    it('should return a user public profile with activity', async () => {
      // Create some activity for user1
      await createPing({ authorId: user1.id, organizationId: org1.id, title: 'Ping by user1' });

      const res = await client
        .get(`/api/users/${user1.id}/profile`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(res.body.id).toBe(user1.id);
      expect(res.body.displayName).toBe('CorrectedHandle');
      expect(res.body.recentPings.length).toBeGreaterThan(0);
      expect(res.body.previousNames.length).toBeGreaterThan(0); // Should show the name we changed
    });

    it('should NOT allow profile access across organizations', async () => {
      const org2 = await createOrganization({ name: 'Org Two', domain: 'org2.edu' });
      const userOtherOrg = await createUser({ organizationId: org2.id, email: 'other@org2.edu' });
      const loginRes = await client
        .post('/api/users/login')
        .send({ email: 'other@org2.edu', password: 'Password123!' })
        .expect(200);
      const otherOrgToken = loginRes.body.token;

      await client
        .get(`/api/users/${user1.id}/profile`)
        .set('Authorization', `Bearer ${otherOrgToken}`)
        .expect(404);
    });
  });
});
