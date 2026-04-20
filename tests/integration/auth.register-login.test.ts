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
  const resendGenericMessage =
    'If an account exists for that email, a verification link will arrive shortly.';
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

  it('returns pending approval when organization join policy requires approval', async () => {
    const prisma = getPrisma();
    const request = await buildTestClient({ disableRateLimiting: true });

    const approvalOrg = await prisma.organization.create({
      data: {
        name: `Approval Org ${Date.now()}`,
        domain: `approval${Date.now()}.edu`,
        status: 'ACTIVE',
        joinPolicy: 'REQUIRES_APPROVAL',
      },
    });

    const pendingEmail = `pending@${approvalOrg.domain}`;

    const registerRes = await request
      .post('/api/users/register')
      .send({
        email: pendingEmail,
        password,
        firstName: 'Pending',
        lastName: 'Approval',
        level: 2,
      });

    expect(registerRes.status).toBe(202);
    expect(registerRes.body).toHaveProperty('code', 'ORG_JOIN_APPROVAL_REQUIRED');
  });

  it('requires organizationId for personal-email login', async () => {
    const request = await buildTestClient({ disableRateLimiting: true });
    const loginRes = await request
      .post('/api/users/login')
      .send({ email: 'alice.personal@gmail.com', password: 'Password123!' });

    expect(loginRes.status).toBe(400);
    expect(loginRes.body).toHaveProperty('code', 'ORG_ID_REQUIRED_FOR_PERSONAL_EMAIL');
  });

  it('logs in personal-email users when organizationId is provided', async () => {
    const prisma = getPrisma();
    const request = await buildTestClient({ disableRateLimiting: true });
    const personalEmail = 'alice.personal@gmail.com';

    const registerRes = await request
      .post('/api/users/register')
      .send({
        email: personalEmail,
        password,
        firstName: 'Alice',
        lastName: 'Personal',
        organizationId,
      });

    expect(registerRes.status).toBe(201);

    await prisma.user.update({
      where: {
        email_organizationId: {
          email: personalEmail.toLowerCase(),
          organizationId,
        },
      },
      data: {
        status: 'ACTIVE',
      },
    });

    const loginRes = await request
      .post('/api/users/login')
      .send({ email: personalEmail, password, organizationId });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();
  });

  it('resends verification and rotates token for unverified users', async () => {
    const prisma = getPrisma();
    const request = await buildTestClient({ disableRateLimiting: true });
    const resendEmail = `resend-${Date.now()}@example.edu`;

    const registerRes = await request
      .post('/api/users/register')
      .send({
        email: resendEmail,
        password,
        firstName: 'Resend',
        lastName: 'Tester',
      });

    expect(registerRes.status).toBe(201);

    const user = await prisma.user.findUnique({
      where: {
        email_organizationId: {
          email: resendEmail.toLowerCase(),
          organizationId,
        },
      },
      select: {
        id: true,
      },
    });

    expect(user).toBeTruthy();

    const tokenBeforeResend = await prisma.emailVerificationToken.findFirst({
      where: { userId: user!.id },
      orderBy: { createdAt: 'desc' },
    });

    expect(tokenBeforeResend).toBeTruthy();

    const resendRes = await request
      .post('/api/users/resend-verification')
      .send({ email: resendEmail });

    expect(resendRes.status).toBe(200);
    expect(resendRes.body).toHaveProperty('message', resendGenericMessage);

    const tokensAfterResend = await prisma.emailVerificationToken.findMany({
      where: { userId: user!.id },
      orderBy: { createdAt: 'desc' },
    });

    expect(tokensAfterResend).toHaveLength(1);
    expect(tokensAfterResend[0].token).not.toBe(tokenBeforeResend!.token);
    expect(tokensAfterResend[0].used).toBe(false);
  });

  it('returns generic response for unknown emails without creating tokens', async () => {
    const prisma = getPrisma();
    const request = await buildTestClient({ disableRateLimiting: true });

    const tokenCountBefore = await prisma.emailVerificationToken.count();

    const res = await request
      .post('/api/users/resend-verification')
      .send({ email: `missing-${Date.now()}@example.edu` });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', resendGenericMessage);

    const tokenCountAfter = await prisma.emailVerificationToken.count();
    expect(tokenCountAfter).toBe(tokenCountBefore);
  });

  it('returns generic response and does not rotate token for verified users', async () => {
    const prisma = getPrisma();
    const request = await buildTestClient({ disableRateLimiting: true });
    const verifiedEmail = `verified-${Date.now()}@example.edu`;

    const registerRes = await request
      .post('/api/users/register')
      .send({
        email: verifiedEmail,
        password,
        firstName: 'Verified',
        lastName: 'Tester',
      });

    expect(registerRes.status).toBe(201);

    const user = await prisma.user.findUnique({
      where: {
        email_organizationId: {
          email: verifiedEmail.toLowerCase(),
          organizationId,
        },
      },
      select: {
        id: true,
      },
    });

    expect(user).toBeTruthy();

    await prisma.user.update({
      where: { id: user!.id },
      data: {
        isVerified: true,
        status: 'ACTIVE',
      },
    });

    const tokenBeforeResend = await prisma.emailVerificationToken.findFirst({
      where: { userId: user!.id },
      orderBy: { createdAt: 'desc' },
    });

    expect(tokenBeforeResend).toBeTruthy();

    const res = await request
      .post('/api/users/resend-verification')
      .send({ email: verifiedEmail });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', resendGenericMessage);

    const tokensAfterResend = await prisma.emailVerificationToken.findMany({
      where: { userId: user!.id },
    });

    expect(tokensAfterResend).toHaveLength(1);
    expect(tokensAfterResend[0].token).toBe(tokenBeforeResend!.token);
  });

  it('returns generic response for personal-email resend without organizationId', async () => {
    const request = await buildTestClient({ disableRateLimiting: true });

    const res = await request
      .post('/api/users/resend-verification')
      .send({ email: 'resend.personal@gmail.com' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', resendGenericMessage);
  });
});
