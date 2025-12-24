import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestClient } from './appClient.js';
import './setupHooks.js';
import { createOrganization, createUser, createCategory, createPing, createWave, createComment, cleanupTestData } from '../fixtures/index.js';

describe('Comment CRUD Operations', () => {
  let client: any;
  let org1: any, org2: any;
  let user1: any, user2: any;
  let category1: any, category2: any;
  let ping1: any, ping2: any;
  let wave1: any, wave2: any;
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

    // Create waves
    wave1 = await createWave({
      pingId: ping1.id,
      organizationId: org1.id,
      solution: 'Solution for ping1'
    });

    wave2 = await createWave({
      pingId: ping2.id,
      organizationId: org2.id,
      solution: 'Solution for ping2'
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

  describe('Create Comment on Ping', () => {
    it('should create a comment on a ping successfully', async () => {
      const commentData = {
        content: 'This is a helpful comment on the ping',
        isAnonymous: false,
      };

      const res = await client
        .post(`/api/pings/${ping1.id}/comments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(commentData)
        .expect(201);

      expect(res.body.content).toBe(commentData.content);
      expect(res.body.isAnonymous).toBe(commentData.isAnonymous);
      expect(res.body.pingId).toBe(ping1.id);
      expect(res.body.waveId).toBeNull();
      expect(res.body.organizationId).toBe(org1.id);
      expect(res.body.author.id).toBe(user1.id);
    });

    it('should create an anonymous comment on a ping', async () => {
      const commentData = {
        content: 'This is an anonymous comment',
        isAnonymous: true,
      };

      const res = await client
        .post(`/api/pings/${ping1.id}/comments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(commentData)
        .expect(201);

      expect(res.body.content).toBe(commentData.content);
      expect(res.body.isAnonymous).toBe(true);
      expect(res.body.author).toBeNull();
    });

    it('should require content', async () => {
      await client
        .post(`/api/pings/${ping1.id}/comments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({})
        .expect(400);
    });

    it('should reject invalid pingId', async () => {
      await client
        .post('/api/pings/99999/comments')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ content: 'Comment for invalid ping' })
        .expect(404);
    });

    it('should reject comment creation for other org ping', async () => {
      await client
        .post(`/api/pings/${ping2.id}/comments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ content: 'Trying to comment on other org ping' })
        .expect(404);
    });
  });

  describe('Create Comment on Wave', () => {
    it('should create a comment on a wave successfully', async () => {
      const commentData = {
        content: 'This is a helpful comment on the wave',
        isAnonymous: false,
      };

      const res = await client
        .post(`/api/waves/${wave1.id}/comments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(commentData)
        .expect(201);

      expect(res.body.content).toBe(commentData.content);
      expect(res.body.isAnonymous).toBe(commentData.isAnonymous);
      expect(res.body.waveId).toBe(wave1.id);
      expect(res.body.pingId).toBeNull();
      expect(res.body.organizationId).toBe(org1.id);
      expect(res.body.author.id).toBe(user1.id);
    });

    it('should create an anonymous comment on a wave', async () => {
      const commentData = {
        content: 'This is an anonymous comment on a wave',
        isAnonymous: true,
      };

      const res = await client
        .post(`/api/waves/${wave1.id}/comments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(commentData)
        .expect(201);

      expect(res.body.content).toBe(commentData.content);
      expect(res.body.isAnonymous).toBe(true);
      expect(res.body.author).toBeNull();
    });

    it('should require content for wave comments', async () => {
      await client
        .post(`/api/waves/${wave1.id}/comments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({})
        .expect(400);
    });

    it('should reject invalid waveId', async () => {
      await client
        .post('/api/waves/99999/comments')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ content: 'Comment for invalid wave' })
        .expect(404);
    });

    it('should reject comment creation for other org wave', async () => {
      await client
        .post(`/api/waves/${wave2.id}/comments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ content: 'Trying to comment on other org wave' })
        .expect(404);
    });
  });

  describe('Read Comments', () => {
    let pingComment: any, waveComment: any;

    beforeAll(async () => {
      pingComment = await createComment({
        pingId: ping1.id,
        organizationId: org1.id,
        authorId: user1.id,
        content: 'Comment on ping1'
      });

      waveComment = await createComment({
        waveId: wave1.id,
        organizationId: org1.id,
        authorId: user1.id,
        content: 'Comment on wave1'
      });
    });

    it('should get all comments for a ping', async () => {
      const res = await client
        .get(`/api/pings/${ping1.id}/comments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      const comment = res.body.data.find((c: any) => c.id === pingComment.id);
      expect(comment).toBeDefined();
      expect(comment.content).toBe('Comment on ping1');
      expect(comment.author.id).toBe(user1.id);
    });

    it('should get all comments for a wave', async () => {
      const res = await client
        .get(`/api/waves/${wave1.id}/comments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      const comment = res.body.data.find((c: any) => c.id === waveComment.id);
      expect(comment).toBeDefined();
      expect(comment.content).toBe('Comment on wave1');
      expect(comment.author.id).toBe(user1.id);
    });

    it('should return 404 for non-existent ping', async () => {
      await client
        .get('/api/pings/99999/comments')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should return 404 for non-existent wave', async () => {
      await client
        .get('/api/waves/99999/comments')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should NOT allow access to comments of other org ping', async () => {
      await client
        .get(`/api/pings/${ping2.id}/comments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should NOT allow access to comments of other org wave', async () => {
      await client
        .get(`/api/waves/${wave2.id}/comments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should sanitize anonymous comments', async () => {
      const anonComment = await createComment({
        pingId: ping1.id,
        organizationId: org1.id,
        authorId: user1.id,
        content: 'Anonymous comment',
        isAnonymous: true
      });

      const res = await client
        .get(`/api/pings/${ping1.id}/comments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const comment = res.body.data.find((c: any) => c.id === anonComment.id);
      expect(comment.isAnonymous).toBe(true);
      expect(comment.author).toBeNull();
    });
  });
});