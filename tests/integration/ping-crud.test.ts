import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestClient } from './appClient.js';
import './setupHooks.js';
import { createOrganization, createUser, createCategory, createPing, cleanupTestData } from '../fixtures/index.js';

describe('Ping CRUD Operations', () => {
  let client: any;
  let org1: any, org2: any;
  let user1: any, user2: any;
  let category1: any, category2: any;
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

  describe('Create Ping', () => {
    it('should create a ping successfully', async () => {
      const pingData = {
        title: 'Test Ping',
        content: 'This is a test ping content',
        categoryId: category1.id,
        hashtag: '#test',
        isAnonymous: false,
      };

      const res = await client
        .post('/api/pings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(pingData)
        .expect(201);

      expect(res.body).toBeDefined();
      expect(res.body.title).toBe(pingData.title);
      expect(res.body.content).toBe(pingData.content);
      expect(res.body.hashtag).toBe(pingData.hashtag);
      expect(res.body.isAnonymous).toBe(pingData.isAnonymous);
      expect(res.body.authorId).toBe(user1.id);
      expect(res.body.organizationId).toBe(org1.id);
      expect(res.body.categoryId).toBe(category1.id);
      expect(res.body.status).toBe('POSTED');
    });

    it('should create an anonymous ping', async () => {
      const pingData = {
        title: 'Anonymous Ping',
        content: 'This is anonymous',
        categoryId: category1.id,
        isAnonymous: true,
      };

      const res = await client
        .post('/api/pings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(pingData)
        .expect(201);

      expect(res.body.isAnonymous).toBe(true);
      expect(res.body.author).toBeNull(); // Author info should be hidden for anonymous
    });

    it('should require title, content, and categoryId', async () => {
      const res = await client
        .post('/api/pings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ title: 'Test' })
        .expect(400);

      expect(res.body.error).toBe('Validation failed');
    });

    it('should reject invalid categoryId', async () => {
      const pingData = {
        title: 'Test Ping',
        content: 'Content',
        categoryId: 99999, // Non-existent category
      };

      await client
        .post('/api/pings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(pingData)
        .expect(400); // Foreign key constraint violation
    });
  });

  describe('Read Pings', () => {
    let ping1: any, ping2: any;

    beforeAll(async () => {
      // Create test pings
      ping1 = await createPing({
        authorId: user1.id,
        organizationId: org1.id,
        categoryId: category1.id,
        title: 'Ping 1',
        content: 'Content 1'
      });
      ping2 = await createPing({
        authorId: user2.id,
        organizationId: org2.id,
        categoryId: category2.id,
        title: 'Ping 2',
        content: 'Content 2'
      });
    });

    it('should get all pings for user organization', async () => {
      const res = await client
        .get('/api/pings')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Should only see org1 pings
      res.body.data.forEach((ping: any) => {
        expect(ping.organizationId).toBe(org1.id);
        // Assert hasSurged is present and boolean
        expect(typeof ping.hasSurged).toBe('boolean');
        expect(ping.hasSurged).toBe(false);
      });
    });

    it('should get specific ping by ID', async () => {
      const res = await client
        .get(`/api/pings/${ping1.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(res.body.id).toBe(ping1.id);
      expect(res.body.title).toBe(ping1.title);
      expect(res.body.content).toBe(ping1.content);
      expect(res.body.organizationId).toBe(org1.id);
      // Assert hasSurged is present and boolean
      expect(typeof res.body.hasSurged).toBe('boolean');
      expect(res.body.hasSurged).toBe(false);
    });

    it('should return 404 for non-existent ping', async () => {
      await client
        .get('/api/pings/99999')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should NOT allow access to other org pings', async () => {
      // User1 trying to access ping2 (org2)
      await client
        .get(`/api/pings/${ping2.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should get user own pings', async () => {
      const res = await client
        .get('/api/pings/me')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      // Note: getMyPings doesn't include authorId in response for privacy
    });
  });

  describe('Update Ping', () => {
    let pingToUpdate: any;

    beforeAll(async () => {
      pingToUpdate = await createPing({
        authorId: user1.id,
        organizationId: org1.id,
        categoryId: category1.id,
        title: 'Original Title',
        content: 'Original Content'
      });
    });

    it('should update ping successfully', async () => {
      const updateData = {
        title: 'Updated Title',
        content: 'Updated Content',
        hashtag: '#updated',
      };

      const res = await client
        .patch(`/api/pings/${pingToUpdate.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateData)
        .expect(200);

      expect(res.body.title).toBe(updateData.title);
      expect(res.body.content).toBe(updateData.content);
      expect(res.body.hashtag).toBe(updateData.hashtag);
    });

    it('should NOT allow updating other user pings', async () => {
      const otherUserPing = await createPing({
        authorId: user2.id,
        organizationId: org2.id,
        categoryId: category2.id,
        title: 'Other User Ping',
        content: 'Content'
      });

      await client
        .patch(`/api/pings/${otherUserPing.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ title: 'Hacked Title' })
        .expect(404); // Should not find the ping due to org isolation
    });

    it('should allow partial updates', async () => {
      const res = await client
        .patch(`/api/pings/${pingToUpdate.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ title: 'Partially Updated' })
        .expect(200);

      expect(res.body.title).toBe('Partially Updated');
      expect(res.body.content).toBe('Updated Content'); // Should remain unchanged
    });
  });

  describe('Delete Ping', () => {
    let pingToDelete: any;

    beforeAll(async () => {
      pingToDelete = await createPing({
        authorId: user1.id,
        organizationId: org1.id,
        categoryId: category1.id,
        title: 'Ping to Delete',
        content: 'Will be deleted'
      });
    });

    it('should delete ping successfully', async () => {
      // First verify it exists
      await client
        .get(`/api/pings/${pingToDelete.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      // Delete it
      await client
        .delete(`/api/pings/${pingToDelete.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(204);

      // Verify it's gone
      await client
        .get(`/api/pings/${pingToDelete.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should NOT allow deleting other user pings', async () => {
      const otherUserPing = await createPing({
        authorId: user2.id,
        organizationId: org2.id,
        categoryId: category2.id,
        title: 'Other User Ping',
        content: 'Content'
      });

      await client
        .delete(`/api/pings/${otherUserPing.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404); // Should not find the ping due to org isolation
    });
  });
});