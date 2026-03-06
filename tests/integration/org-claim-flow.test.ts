import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestClient } from './appClient.js';
import './setupHooks.js';
import { cleanupTestData, createOrganization, createUser } from '../fixtures/index.js';

describe('Organization Claim Flow', () => {
  let client: any;
  let superAdminToken: string;
  let unclaimedOrg: any;

  beforeAll(async () => {
    client = await buildTestClient({ disableRateLimiting: true });

    const authOrg = await createOrganization({
      name: `Claim Auth Org ${Date.now()}`,
      domain: `claim-auth-${Date.now()}.edu`,
      status: 'ACTIVE',
      joinPolicy: 'OPEN',
      isClaimVerified: true,
      categoryCustomizationLocked: false,
    });

    unclaimedOrg = await createOrganization({
      name: `Claimable Org ${Date.now()}`,
      domain: `claimable-${Date.now()}.edu`,
      status: 'ACTIVE',
      joinPolicy: 'REQUIRES_APPROVAL',
      isClaimVerified: false,
      categoryCustomizationLocked: true,
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

  it('rejects claim when email domain does not match preseeded organization domain', async () => {
    const res = await client
      .post(`/api/users/organizations/${unclaimedOrg.id}/claim`)
      .send({
        email: `student@other-domain.edu`,
        firstName: 'Ada',
        lastName: 'Mismatch',
        password: 'Password123!',
      })
      .expect(403);

    expect(res.body.code).toBe('ORG_CLAIM_DOMAIN_MISMATCH');
  });

  it('creates a pending claim and prevents duplicate pending claim from same user', async () => {
    const email = `leader@${unclaimedOrg.domain}`;

    const first = await client
      .post(`/api/users/organizations/${unclaimedOrg.id}/claim`)
      .send({
        email,
        firstName: 'Ife',
        lastName: 'Leader',
        password: 'Password123!',
      })
      .expect(201);

    expect(first.body.code).toBe('ORG_CLAIM_SUBMITTED');
    expect(first.body.claim.status).toBe('PENDING');

    const second = await client
      .post(`/api/users/organizations/${unclaimedOrg.id}/claim`)
      .send({
        email,
        firstName: 'Ife',
        lastName: 'Leader',
        password: 'Password123!',
      })
      .expect(409);

    expect(second.body.code).toBe('ORG_CLAIM_ALREADY_PENDING');
  });

  it('blocks category creation while organization claim remains unverified', async () => {
    const res = await client
      .post('/api/categories')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('x-organization-id', String(unclaimedOrg.id))
      .send({ name: 'Student Life' })
      .expect(403);

    expect(res.body.code).toBe('ORG_CLAIM_VERIFICATION_REQUIRED');
  });

  it('approves verified claimant and unlocks category customization', async () => {
    const prismaModule = await import('../../src/config/db.js');
    const prisma = prismaModule.default;

    const claim = await prisma.organizationClaim.findFirst({
      where: {
        organizationId: unclaimedOrg.id,
        status: 'PENDING',
      },
      include: {
        user: true,
      },
    });

    expect(claim).toBeTruthy();

    await prisma.user.update({
      where: { id: claim!.userId },
      data: { isVerified: true },
    });

    const approveRes = await client
      .post(`/api/admin/organization-claims/${claim!.id}/approve`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(approveRes.body.claim.status).toBe('APPROVED');

    const updatedOrg = await prisma.organization.findUnique({
      where: { id: unclaimedOrg.id },
      select: {
        isClaimVerified: true,
        categoryCustomizationLocked: true,
      },
    });

    expect(updatedOrg?.isClaimVerified).toBe(true);
    expect(updatedOrg?.categoryCustomizationLocked).toBe(false);

    const updatedUser = await prisma.user.findUnique({
      where: { id: claim!.userId },
      select: { role: true, status: true },
    });

    expect(updatedUser?.role).toBe('ADMIN');
    expect(updatedUser?.status).toBe('ACTIVE');

    const categories = await prisma.category.findMany({
      where: { organizationId: unclaimedOrg.id },
      select: { name: true },
    });

    const categoryNames = categories.map((category: { name: string }) => category.name);
    expect(categoryNames).toContain('General');
    expect(categoryNames).toContain('Academics');
    expect(categoryNames).toContain('Facilities');

    await client
      .post('/api/categories')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('x-organization-id', String(unclaimedOrg.id))
      .send({ name: 'Hostels' })
      .expect(201);
  });
});
