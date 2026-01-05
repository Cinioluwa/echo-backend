import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestClient } from './appClient.js';
import './setupHooks.js';
import { createUser, createOrganization, createCategory, createPing, cleanupTestData } from '../fixtures/index.js';

describe('Admin Operations', () => {
  let client: any;
  let org1: any, org2: any;
  let adminUser: any, regularUser: any, otherOrgUser: any;
  let category1: any, category2: any;
  let adminToken: string, regularToken: string, otherOrgToken: string;
  let ping1: any, ping2: any;

  beforeAll(async () => {
    // Setup test data
    client = await buildTestClient({ disableRateLimiting: true });

    // Create organizations
    org1 = await createOrganization({ name: 'Test Org 1', domain: 'testorg1.edu' });
    org2 = await createOrganization({ name: 'Test Org 2', domain: 'testorg2.edu' });

    // Create users
    adminUser = await createUser({
      email: 'admin@testorg1.edu',
      firstName: 'Admin',
      lastName: 'User',
      organizationId: org1.id,
      role: 'ADMIN'
    });

    regularUser = await createUser({
      email: 'user@testorg1.edu',
      firstName: 'Regular',
      lastName: 'User',
      organizationId: org1.id,
      role: 'USER'
    });

    otherOrgUser = await createUser({
      email: 'user@testorg2.edu',
      firstName: 'Other',
      lastName: 'User',
      organizationId: org2.id,
      role: 'USER'
    });

    // Create categories
    category1 = await createCategory({ name: 'Academic', organizationId: org1.id });
    category2 = await createCategory({ name: 'Administrative', organizationId: org1.id });

    // Create pings
    ping1 = await createPing({
      title: 'Test Ping 1',
      content: 'Content for ping 1',
      categoryId: category1.id,
      organizationId: org1.id,
      authorId: regularUser.id
    });

    ping2 = await createPing({
      title: 'Test Ping 2',
      content: 'Content for ping 2',
      categoryId: category2.id,
      organizationId: org1.id,
      authorId: regularUser.id
    });

    // Login users
    const adminLogin = await client
      .post('/api/users/login')
      .send({ email: adminUser.email, password: 'Password123!' })
      .expect(200);
    adminToken = adminLogin.body.token;

    const regularLogin = await client
      .post('/api/users/login')
      .send({ email: regularUser.email, password: 'Password123!' })
      .expect(200);
    regularToken = regularLogin.body.token;

    const otherOrgLogin = await client
      .post('/api/users/login')
      .send({ email: otherOrgUser.email, password: 'Password123!' })
      .expect(200);
    otherOrgToken = otherOrgLogin.body.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Platform Stats', () => {
    it('should get platform stats for admin', async () => {
      const res = await client
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('totalUsers');
      expect(res.body).toHaveProperty('totalPings');
      expect(res.body).toHaveProperty('totalSurges');
      expect(res.body).toHaveProperty('totalWaves');
      expect(res.body).toHaveProperty('totalComments');

      expect(typeof res.body.totalUsers).toBe('number');
      expect(typeof res.body.totalPings).toBe('number');
      expect(typeof res.body.totalSurges).toBe('number');
      expect(typeof res.body.totalWaves).toBe('number');
      expect(typeof res.body.totalComments).toBe('number');
    });

    it('should support weekly window stats (previous week is empty in tests)', async () => {
      const res = await client
        .get('/api/admin/stats?weeks=1&offsetWeeks=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.totalUsers).toBe(0);
      expect(res.body.totalPings).toBe(0);
      expect(res.body.totalSurges).toBe(0);
      expect(res.body.totalWaves).toBe(0);
      expect(res.body.totalComments).toBe(0);
      expect(res.body.totalOrganizations).toBe(1);
      expect(res.body).toHaveProperty('window');
      expect(res.body.window).toHaveProperty('weeks', 1);
      expect(res.body.window).toHaveProperty('offsetWeeks', 1);
    });

    it('should reject non-admin access to stats', async () => {
      await client
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });

    it('should require authentication for stats', async () => {
      await client
        .get('/api/admin/stats')
        .expect(401);
    });
  });

  describe('User Management', () => {
    it('should get all users for admin', async () => {
      const res = await client
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      const user = res.body.find((u: any) => u.id === regularUser.id);
      expect(user).toBeDefined();
      expect(user.email).toBe(regularUser.email);
      expect(user.role).toBe(regularUser.role);
      expect(user).toHaveProperty('firstName');
      expect(user).toHaveProperty('lastName');
      expect(user).toHaveProperty('createdAt');
    });

    it('should get specific user by ID', async () => {
      const res = await client
        .get(`/api/admin/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.id).toBe(regularUser.id);
      expect(res.body.email).toBe(regularUser.email);
      expect(res.body.role).toBe(regularUser.role);
      expect(res.body).toHaveProperty('level');
      expect(res.body).toHaveProperty('pings');
      expect(res.body).toHaveProperty('comments');
      expect(res.body).toHaveProperty('surges');
    });

    it('should return 404 for non-existent user', async () => {
      await client
        .get('/api/admin/users/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should update user role', async () => {
      const res = await client
        .patch(`/api/admin/users/${regularUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'REPRESENTATIVE' })
        .expect(200);

      expect(res.body.id).toBe(regularUser.id);
      expect(res.body.role).toBe('REPRESENTATIVE');
      expect(res.body.email).toBe(regularUser.email);
    });

    it('should reject invalid role', async () => {
      await client
        .patch(`/api/admin/users/${regularUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'INVALID_ROLE' })
        .expect(400);
    });

    it('should reject updating user from different organization', async () => {
      await client
        .patch(`/api/admin/users/${otherOrgUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'ADMIN' })
        .expect(404);
    });
  });

  describe('Ping Management', () => {
    it('should get all pings as admin', async () => {
      const res = await client
        .get('/api/admin/pings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.pagination).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should delete any ping as admin', async () => {
      // First verify ping exists
      await client
        .get(`/api/pings/${ping1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Delete as admin
      await client
        .delete(`/api/admin/pings/${ping1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      // Verify ping is deleted
      await client
        .get(`/api/pings/${ping1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should update ping progress status', async () => {
      const res = await client
        .patch(`/api/admin/pings/${ping2.id}/progress-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);

      expect(res.body.id).toBe(ping2.id);
      expect(res.body.progressStatus).toBe('IN_PROGRESS');
      expect(res.body).toHaveProperty('progressUpdatedAt');
    });

    it('should reject invalid progress status', async () => {
      await client
        .patch(`/api/admin/pings/${ping2.id}/progress-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);
    });
  });

  describe('Analytics', () => {
    it('should get ping stats by level', async () => {
      const res = await client
        .get('/api/admin/analytics/by-level')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // Should have at least one level entry
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('value');
      expect(typeof res.body[0].value).toBe('number');
    });

    it('should get ping stats by category', async () => {
      const res = await client
        .get('/api/admin/analytics/by-category')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('count');
      expect(typeof res.body[0].count).toBe('number');
    });

    it('should get active users for the current week window', async () => {
      const res = await client
        .get('/api/admin/analytics/active-users?weeks=1&offsetWeeks=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('activeUsers');
      expect(typeof res.body.activeUsers).toBe('number');
      expect(res.body.activeUsers).toBeGreaterThan(0);
    });

    it('should return 0 active users for previous week window in tests', async () => {
      const res = await client
        .get('/api/admin/analytics/active-users?weeks=1&offsetWeeks=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.activeUsers).toBe(0);
    });
  });

  describe('Announcement Management', () => {
    let announcementId: number;

    it('should create announcement', async () => {
      const res = await client
        .post('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Test Announcement',
          content: 'This is a test announcement content',
          categoryIds: [category1.id]
        })
        .expect(201);

      announcementId = res.body.id;
      expect(res.body.title).toBe('Test Announcement');
      expect(res.body.content).toBe('This is a test announcement content');
      expect(res.body.categories).toHaveLength(1);
      expect(res.body.categories[0].id).toBe(category1.id);
    });

    it('should update announcement', async () => {
      const res = await client
        .patch(`/api/admin/announcements/${announcementId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Updated Announcement',
          content: 'Updated content'
        })
        .expect(200);

      expect(res.body.id).toBe(announcementId);
      expect(res.body.title).toBe('Updated Announcement');
      expect(res.body.content).toBe('Updated content');
    });

    it('should delete announcement', async () => {
      await client
        .delete(`/api/admin/announcements/${announcementId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });
  });

  describe('Access Control', () => {
    it('should reject non-admin access to all admin endpoints', async () => {
      const endpoints = [
        '/api/admin/stats',
        '/api/admin/users',
        `/api/admin/users/${regularUser.id}`,
        '/api/admin/pings',
        '/api/admin/analytics/by-level',
        '/api/admin/analytics/by-category'
      ];

      for (const endpoint of endpoints) {
        await client
          .get(endpoint)
          .set('Authorization', `Bearer ${regularToken}`)
          .expect(403);
      }
    });

    it('should require authentication for admin endpoints', async () => {
      await client
        .get('/api/admin/stats')
        .expect(401);
    });
  });
});
