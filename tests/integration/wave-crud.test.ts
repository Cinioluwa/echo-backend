import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestClient } from './appClient.js';
import './setupHooks.js';
import { createOrganization, createUser, createCategory, createPing, createWave, cleanupTestData } from '../fixtures/index.js';

describe('Wave CRUD Operations', () => {
  let client: any;
  let org1: any, org2: any;
  let user1: any, user2: any;
  let category1: any, category2: any;
  let ping1: any, ping2: any;
  let user1Token: string, user2Token: string;

  beforeAll(async () => {
    // Setup test data
    client = await buildTestClient({ disableRateLimiting: true });

    // Create organizations
    org1 = await createOrganization({ name: 'Org One', domain: 'org1.edu' });
    org2 = await createOrganization({ name: 'Org Two', domain: 'org2.edu' });

    // Create users
    user1 = await createUser({
      organizationId: org1.id,
      email: 'user1@org1.edu',
      firstName: 'User',
      lastName: 'One'
    });
    user2 = await createUser({
      organizationId: org2.id,
      email: 'user2@org2.edu',
      firstName: 'User',
      lastName: 'Two'
    });

    // Create categories
    category1 = await createCategory({ organizationId: org1.id, name: 'Tech Support' });
    category2 = await createCategory({ organizationId: org2.id, name: 'HR Issues' });

    // Create pings
    ping1 = await createPing({
      authorId: user1.id,
      organizationId: org1.id,
      categoryId: category1.id,
      title: 'Ping1',
      content: 'Content1'
    });

    ping2 = await createPing({
      authorId: user2.id,
      organizationId: org2.id,
      categoryId: category2.id,
      title: 'Ping2',
      content: 'Content2'
    });

    // Login users to get tokens
    const login1Res = await client
      .post('/api/users/login')
      .send({ email: 'user1@org1.edu', password: 'Password123!' })
      .expect(200);
    user1Token = login1Res.body.token;

    const login2Res = await client
      .post('/api/users/login')
      .send({ email: 'user2@org2.edu', password: 'Password123!' })
      .expect(200);
    user2Token = login2Res.body.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Create Wave', () => {
    it('should create a wave successfully', async () => {
      const waveData = {
        solution: 'This is a great solution to the problem',
        isAnonymous: false,
      };

      const res = await client
        .post(`/api/pings/${ping1.id}/waves`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(waveData)
        .expect(201);

      expect(res.body.solution).toBe(waveData.solution);
      expect(res.body.isAnonymous).toBe(waveData.isAnonymous);
      expect(res.body.pingId).toBe(ping1.id);
      expect(res.body.organizationId).toBe(org1.id);
      expect(res.body.viewCount).toBe(0);
      expect(res.body.surgeCount).toBe(0);
    });

    it('should create an anonymous wave', async () => {
      const waveData = {
        solution: 'This is an anonymous solution',
        isAnonymous: true,
      };

      const res = await client
        .post(`/api/pings/${ping1.id}/waves`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(waveData)
        .expect(201);

      expect(res.body.solution).toBe(waveData.solution);
      expect(res.body.isAnonymous).toBe(true);
      expect(res.body.pingId).toBe(ping1.id);
    });

    it('should require solution', async () => {
      await client
        .post(`/api/pings/${ping1.id}/waves`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({})
        .expect(400);
    });

    it('should reject invalid pingId', async () => {
      const waveData = {
        solution: 'Solution for invalid ping',
      };

      await client
        .post('/api/pings/99999/waves')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(waveData)
        .expect(404);
    });

    it('should reject wave creation for other org ping', async () => {
      const waveData = {
        solution: 'Trying to create wave for other org ping',
      };

      await client
        .post(`/api/pings/${ping2.id}/waves`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(waveData)
        .expect(404);
    });
  });

  describe('Read Waves', () => {
    let wave1: any, wave2: any;

    beforeAll(async () => {
      // Create test waves
      wave1 = await createWave({
        pingId: ping1.id,
        organizationId: org1.id,
        solution: 'Wave 1 solution'
      });
      wave2 = await createWave({
        pingId: ping2.id,
        organizationId: org2.id,
        solution: 'Wave 2 solution'
      });
    });

    it('should get all waves for a ping', async () => {
      const res = await client
        .get(`/api/pings/${ping1.id}/waves`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.totalWaves).toBeGreaterThan(0);
    });

    it('should get specific wave by ID', async () => {
      const res = await client
        .get(`/api/waves/${wave1.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(res.body.solution).toBe('Wave 1 solution');
      expect(res.body.pingId).toBe(ping1.id);
      expect(res.body.viewCount).toBe(1); // Should be incremented
    });

    it('should return 404 for non-existent wave', async () => {
      await client
        .get('/api/waves/99999')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should NOT allow access to other org wave', async () => {
      await client
        .get(`/api/waves/${wave2.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should NOT allow access to waves of other org ping', async () => {
      await client
        .get(`/api/pings/${ping2.id}/waves`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });
  });

  describe('Update Wave', () => {
    let waveToUpdate: any;

    beforeAll(async () => {
      waveToUpdate = await createWave({
        pingId: ping1.id,
        organizationId: org1.id,
        solution: 'Original solution'
      });
    });

    it('should update wave successfully', async () => {
      const updateData = {
        solution: 'Updated solution',
        isAnonymous: true,
      };

      const res = await client
        .patch(`/api/waves/${waveToUpdate.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateData)
        .expect(200);

      expect(res.body.solution).toBe(updateData.solution);
      expect(res.body.isAnonymous).toBe(updateData.isAnonymous);
    });

    it('should NOT allow updating other user waves', async () => {
      const otherUserWave = await createWave({
        pingId: ping2.id,
        organizationId: org2.id,
        solution: 'Other user wave'
      });

      await client
        .patch(`/api/waves/${otherUserWave.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ solution: 'Hacked solution' })
        .expect(404); // Should not find the wave due to org isolation
    });

    it('should NOT allow non-ping-author to update wave', async () => {
      // Create a wave for ping2 (user2's ping), then try to update it as user1
      const waveForOtherPing = await createWave({
        pingId: ping2.id,
        organizationId: org2.id,
        solution: 'Wave for other ping'
      });

      // user1 is in org1, ping2 is in org2, so organization middleware returns 404
      await client
        .patch(`/api/waves/${waveForOtherPing.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ solution: 'Trying to update' })
        .expect(404); // Not found due to organization isolation
    });

    it('should allow partial updates', async () => {
      const res = await client
        .patch(`/api/waves/${waveToUpdate.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ solution: 'Partially updated solution' })
        .expect(200);

      expect(res.body.solution).toBe('Partially updated solution');
      expect(res.body.isAnonymous).toBe(true); // Should remain unchanged
    });
  });

  describe('Delete Wave', () => {
    let waveToDelete: any;

    beforeAll(async () => {
      waveToDelete = await createWave({
        pingId: ping1.id,
        organizationId: org1.id,
        solution: 'Wave to delete'
      });
    });

    it('should delete wave successfully', async () => {
      // First verify it exists
      await client
        .get(`/api/waves/${waveToDelete.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      // Delete it
      await client
        .delete(`/api/waves/${waveToDelete.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(204);

      // Verify it's gone
      await client
        .get(`/api/waves/${waveToDelete.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should NOT allow deleting other user waves', async () => {
      const otherUserWave = await createWave({
        pingId: ping2.id,
        organizationId: org2.id,
        solution: 'Other user wave to delete'
      });

      await client
        .delete(`/api/waves/${otherUserWave.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404); // Should not find the wave due to org isolation
    });

    it('should NOT allow non-ping-author to delete wave', async () => {
      // Create a wave for ping2 (user2's ping), then try to delete it as user1
      const waveForOtherPing = await createWave({
        pingId: ping2.id,
        organizationId: org2.id,
        solution: 'Wave for other ping to delete'
      });

      // user1 is in org1, ping2 is in org2, so organization middleware returns 404
      await client
        .delete(`/api/waves/${waveForOtherPing.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404); // Not found due to organization isolation
    });
  });
});