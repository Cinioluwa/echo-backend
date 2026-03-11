import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getPrisma } from './testContainer.js';
import { buildTestClient } from './appClient.js';
import './setupHooks.js';
import { cleanupTestData, createOrganization, createUser } from '../fixtures/index.js';

vi.mock('../../src/services/emailService.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  buildVerificationEmail: () => ({ subject: '', text: '', html: '' }),
  buildPasswordResetEmail: () => ({ subject: '', text: '', html: '' }),
  buildOrganizationRequestEmail: () => ({ subject: '', text: '', html: '' }),
}));

describe('Selection-only onboarding', () => {
  let client: any;
  let superAdminToken: string;

  beforeAll(async () => {
    client = await buildTestClient({ disableRateLimiting: true });

    const authOrg = await createOrganization({
      name: `Onboarding Auth Org ${Date.now()}`,
      domain: `onboarding-auth-${Date.now()}.edu`,
      status: 'ACTIVE',
    });

    const superAdmin = await createUser({
      email: `superadmin@${authOrg.domain}`,
      organizationId: authOrg.id,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      isVerified: true,
    });

    const loginRes = await client
      .post('/api/users/login')
      .send({ email: superAdmin.email, password: 'Password123!' })
      .expect(200);

    superAdminToken = loginRes.body.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('lists active organizations for onboarding selection', async () => {
    await createOrganization({
      name: 'Lagos Metropolitan College',
      domain: `lagos-college-${Date.now()}.edu.ng`,
      status: 'ACTIVE',
      isClaimVerified: false,
      categoryCustomizationLocked: true,
    });

    await createOrganization({
      name: 'Dormant Campus',
      domain: `dormant-campus-${Date.now()}.edu.ng`,
      status: 'PENDING',
    });

    const res = await client
      .get('/api/users/organizations')
      .query({ query: 'lagos', limit: 10 })
      .expect(200);

    expect(res.body.count).toBeGreaterThan(0);
    expect(
      res.body.organizations.some(
        (org: { name: string }) => org.name === 'Lagos Metropolitan College'
      )
    ).toBe(true);
    expect(
      res.body.organizations.some(
        (org: { name: string }) => org.name === 'Dormant Campus'
      )
    ).toBe(false);
  });

  it('stores waitlist requests without creating organizations directly', async () => {
    const prisma = getPrisma();
    const domain = `new-school-${Date.now()}.edu.ng`;
    const email = `admin@${domain}`;

    const waitlistRes = await client
      .post('/api/users/organization-waitlist')
      .send({
        organizationName: 'New School University',
        email,
        metadata: {
          requestedBy: 'product-team',
        },
      })
      .expect(201);

    expect(waitlistRes.body.requestId).toBeDefined();

    const requestRecord = await prisma.organizationRequest.findUnique({
      where: { domain },
    });

    expect(requestRecord).toBeTruthy();
    expect(requestRecord?.status).toBe('PENDING');

    const organization = await prisma.organization.findUnique({
      where: { domain },
    });
    expect(organization).toBeNull();

    const requesterUser = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
    });
    expect(requesterUser).toBeNull();
  });

  it('creates organization only after super admin approval and seeds default categories', async () => {
    const prisma = getPrisma();
    const domain = `approved-school-${Date.now()}.edu.ng`;

    const request = await prisma.organizationRequest.create({
      data: {
        organizationName: 'Approved School',
        domain,
        requesterEmail: `owner@${domain}`,
      },
    });

    await client
      .post(`/api/admin/organization-requests/${request.id}/approve`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    const org = await prisma.organization.findUnique({
      where: { domain },
    });

    expect(org).toBeTruthy();
    expect(org?.status).toBe('ACTIVE');
    expect(org?.isClaimVerified).toBe(true);
    expect(org?.categoryCustomizationLocked).toBe(false);

    const updatedRequest = await prisma.organizationRequest.findUnique({
      where: { id: request.id },
    });

    expect(updatedRequest?.status).toBe('APPROVED');
    expect(updatedRequest?.organizationId).toBe(org?.id);

    const categories = await prisma.category.findMany({
      where: { organizationId: org!.id },
      select: { name: true },
    });

    const names = categories.map((category: { name: string }) => category.name);
    expect(names).toContain('General');
    expect(names).toContain('Academics');
    expect(names).toContain('Facilities');
  });
});
