import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { getPrisma } from './testContainer.js';
import { buildTestClient } from './appClient.js';
import './setupHooks.js';

// Mock the Google Auth Service
vi.mock('../../src/services/googleAuthService.js', () => ({
  verifyGoogleToken: vi.fn(),
}));

import { verifyGoogleToken } from '../../src/services/googleAuthService.js';

describe('Google Auth Integration', () => {
  const googleEmail = 'testuser@example.com';
  const googleToken = 'mock-google-id-token';
  let organizationId: number;

  beforeAll(async () => {
    const prisma = getPrisma();
    // Ensure clean state
    await prisma.organization.deleteMany();
    
    // Create an organization that matches the email domain
    const org = await prisma.organization.create({
      data: {
        name: 'Example Corp',
        domain: 'example.com',
        status: 'ACTIVE',
      },
    });
    organizationId = org.id;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should authenticate a new user with a valid Google token', async () => {
    const prisma = getPrisma();
    const request = await buildTestClient({ disableRateLimiting: true });

    // Mock the verification response
    vi.mocked(verifyGoogleToken).mockResolvedValue({
      email: googleEmail,
      emailVerified: true,
      firstName: 'Test',
      lastName: 'User',
      googleId: '1234567890',
      picture: 'https://example.com/photo.jpg',
    });

    // Call the endpoint
    const res = await request
      .post('/api/auth/google')
      .send({ token: googleToken });

    // Assertions
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('email', googleEmail);
    expect(res.body.user).toHaveProperty('organizationId', organizationId);

    // Verify user was created in DB
    const user = await prisma.user.findFirst({
      where: { email: googleEmail },
    });
    expect(user).toBeDefined();
    expect(user?.firstName).toBe('Test');
    expect(user?.lastName).toBe('User');
    expect(user?.status).toBe('ACTIVE'); // Google users should be auto-activated
  });

  it('should reject authentication if Google verification fails', async () => {
    const request = await buildTestClient({ disableRateLimiting: true });

    // Mock verification failure
    vi.mocked(verifyGoogleToken).mockRejectedValue(new Error('Invalid token payload'));

    const res = await request
      .post('/api/auth/google')
      .send({ token: 'invalid-token' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid Google token');
  });

  it('should reject if email domain does not match any organization', async () => {
    const request = await buildTestClient({ disableRateLimiting: true });

    vi.mocked(verifyGoogleToken).mockResolvedValue({
      email: 'outsider@nonexistent.com',
      emailVerified: true,
      firstName: 'Outsider',
      lastName: 'Person',
      googleId: '0987654321',
    });

    const res = await request
      .post('/api/auth/google')
      .send({ token: googleToken });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('No organization found');
  });

  it('should reject consumer email domains (gmail.com)', async () => {
    const request = await buildTestClient({ disableRateLimiting: true });

    vi.mocked(verifyGoogleToken).mockResolvedValue({
      email: 'tomi@gmail.com',
      emailVerified: true,
      firstName: 'Tomi',
      lastName: 'Dev',
      googleId: 'consumer-123',
    });

    const res = await request
      .post('/api/auth/google')
      .send({ token: googleToken });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('Consumer email domains are not allowed');
  });
});
