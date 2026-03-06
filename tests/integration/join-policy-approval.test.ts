import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestClient } from './appClient.js';
import './setupHooks.js';
import { cleanupTestData, createOrganization, createUser } from '../fixtures/index.js';

describe('Organization Join Policy Admin Flows', () => {
  let client: any;
  let superAdminToken: string;
  let openDomainOrg: any;
  let approvalOrg: any;

  beforeAll(async () => {
    client = await buildTestClient({ disableRateLimiting: true });

    const authOrg = await createOrganization({
      name: `Auth Org ${Date.now()}`,
      domain: `auth${Date.now()}.edu`,
      status: 'ACTIVE',
      joinPolicy: 'OPEN',
    });

    openDomainOrg = await createOrganization({
      name: `Open Domain Org ${Date.now()}`,
      domain: null,
      status: 'ACTIVE',
      joinPolicy: 'REQUIRES_APPROVAL',
      isDomainLocked: true,
    });

    approvalOrg = await createOrganization({
      name: `Approval Org ${Date.now()}`,
      domain: `approval${Date.now()}.edu`,
      status: 'ACTIVE',
      joinPolicy: 'REQUIRES_APPROVAL',
    });

    const superAdmin = await createUser({
      email: `superadmin@${authOrg.domain}`,
      organizationId: authOrg.id,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
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

  it('returns locked join settings for open-domain organizations', async () => {
    const res = await client
      .get('/api/admin/organization/settings')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('x-organization-id', String(openDomainOrg.id))
      .expect(200);

    expect(res.body.organization.joinPolicyLocked).toBe(true);
    expect(res.body.organization.effectiveJoinPolicy).toBe('REQUIRES_APPROVAL');
  });

  it('rejects changing open-domain org join policy to OPEN', async () => {
    const res = await client
      .patch('/api/admin/organization/join-policy')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('x-organization-id', String(openDomainOrg.id))
      .send({ joinPolicy: 'OPEN' })
      .expect(400);

    expect(res.body.code).toBe('JOIN_POLICY_LOCKED');
  });

  it('approves pending organization join request and activates verified user', async () => {
    const pendingUser = await createUser({
      email: `pending@${approvalOrg.domain}`,
      organizationId: approvalOrg.id,
      role: 'USER',
      status: 'PENDING',
    });

    const prismaModule = await import('../../src/config/db.js');
    const prisma = prismaModule.default;

    await prisma.user.update({
      where: { id: pendingUser.id },
      data: { isVerified: true },
    });

    const joinRequest = await prisma.organizationJoinRequest.create({
      data: {
        organizationId: approvalOrg.id,
        userId: pendingUser.id,
        email: pendingUser.email,
        status: 'PENDING',
      },
    });

    await client
      .post(`/api/admin/organization/join-requests/${joinRequest.id}/approve`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('x-organization-id', String(approvalOrg.id))
      .expect(200);

    const updatedUser = await prisma.user.findUnique({ where: { id: pendingUser.id } });
    const updatedRequest = await prisma.organizationJoinRequest.findUnique({ where: { id: joinRequest.id } });

    expect(updatedUser?.status).toBe('ACTIVE');
    expect(updatedRequest?.status).toBe('APPROVED');
  });
});
