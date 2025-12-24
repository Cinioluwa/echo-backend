import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPrisma } from '../integration/testContainer.js';
import { buildTestClient } from '../integration/appClient.js';
import './setupHooks.js';
import { createOrganization, createUser, createCategory, createPing, createWave, cleanupTestData } from '../fixtures/index.js';

describe('Test Fixtures', () => {
  const prisma = getPrisma();

  afterAll(async () => {
    await cleanupTestData();
  });

  it('should create organization with defaults', async () => {
    const org = await createOrganization();
    expect(org.name).toContain('Test Org');
    expect(org.domain).toContain('test');
    expect(org.status).toBe('ACTIVE');
  });

  it('should create organization with custom data', async () => {
    const org = await createOrganization({
      name: 'Custom University',
      domain: 'custom.edu',
      status: 'PENDING',
    });
    expect(org.name).toBe('Custom University');
    expect(org.domain).toBe('custom.edu');
    expect(org.status).toBe('PENDING');
  });

  it('should create user with defaults', async () => {
    const user = await createUser();
    expect(user.email).toContain('user');
    expect(user.firstName).toBe('Test');
    expect(user.lastName).toBe('User');
    expect(user.role).toBe('USER');
    expect(user.status).toBe('ACTIVE');
    expect(user.organizationId).toBeDefined();
  });

  it('should create category with defaults', async () => {
    const category = await createCategory();
    expect(category.name).toContain('Test Category');
    expect(category.organizationId).toBeDefined();
  });

  it('should create ping with defaults', async () => {
    const ping = await createPing();
    expect(ping.title).toContain('Test Ping');
    expect(ping.content).toBe('This is a test ping content');
    expect(ping.status).toBe('POSTED');
    expect(ping.authorId).toBeDefined();
    expect(ping.organizationId).toBeDefined();
    expect(ping.categoryId).toBeDefined();
  });

  it('should create wave with defaults', async () => {
    const wave = await createWave();
    expect(wave.solution).toContain('Test Wave Solution');
    expect(wave.pingId).toBeDefined();
    expect(wave.organizationId).toBeDefined();
  });

  it('should create related entities correctly', async () => {
    const org = await createOrganization({ name: 'Related Test Org', domain: 'related.edu' });
    const user = await createUser({ organizationId: org.id, email: 'related@example.edu' });
    const category = await createCategory({ organizationId: org.id, name: 'Related Category' });
    const ping = await createPing({
      organizationId: org.id,
      authorId: user.id,
      categoryId: category.id,
      title: 'Related Ping'
    });
    const wave = await createWave({
      organizationId: org.id,
      pingId: ping.id,
      solution: 'Related Solution'
    });

    // Verify relationships
    expect(user.organizationId).toBe(org.id);
    expect(category.organizationId).toBe(org.id);
    expect(ping.organizationId).toBe(org.id);
    expect(ping.authorId).toBe(user.id);
    expect(ping.categoryId).toBe(category.id);
    expect(wave.organizationId).toBe(org.id);
    expect(wave.pingId).toBe(ping.id);
  });
});