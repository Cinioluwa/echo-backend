import { describe, it, expect, beforeAll } from 'vitest';
import { getPrisma } from './testContainer.js';
import { buildTestClient } from './appClient.js';
import './setupHooks.js';
import { vi } from 'vitest';

vi.mock('../../src/services/emailService.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  buildVerificationEmail: () => ({ subject: '', text: '', html: '' }),
  buildPasswordResetEmail: () => ({ subject: '', text: '', html: '' }),
  buildOrganizationRequestEmail: () => ({ subject: '', text: '', html: '' }),
}));

describe('Auth register/login', () => {
  const email = 'alice@example.edu';
  const password = 'Password123!';
  let organizationId: number;

  beforeAll(async () => {
    const prisma = getPrisma();
    await prisma.organization.deleteMany();
    const org = await prisma.organization.create({
      data: {
        name: 'Example University',
        domain: 'example.edu',
        status: 'ACTIVE',
      },
    });
    organizationId = org.id;
  });

  it('registers a user and logs in after activation', async () => {
    const prisma = getPrisma();
    const request = await buildTestClient({ disableRateLimiting: true });

    const registerRes = await request
      .post('/api/users/register')
      .send({
        email,
        password,
        firstName: 'Alice',
        lastName: 'Tester',
        level: 1,
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.user?.email).toBe(email.toLowerCase());

    await prisma.user.update({
      where: {
        email_organizationId: {
          email: email.toLowerCase(),
          organizationId,
        },
      },
      data: {
        status: 'ACTIVE',
      },
    });

    const loginRes = await request
      .post('/api/users/login')
      .send({ email, password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();
  });
});
