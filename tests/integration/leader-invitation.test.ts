import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildTestClient } from './appClient.js';
import './setupHooks.js';
import { cleanupTestData, createOrganization, createUser, createInvitation } from '../fixtures/index.js';
import { getPrisma } from './testContainer.js';

vi.mock('../../src/services/emailService.js', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    sendEmail: vi.fn().mockResolvedValue(undefined),
  };
});

describe('Leader Invitation Flow', () => {
  let request: any;
  let authUser: any;
  let authToken: string;
  let unclaimedOrg: any;

  beforeAll(async () => {
    request = await buildTestClient({ disableRateLimiting: true });
    
    // Create an organization and an authenticated user to perform the invitation
    const org = await createOrganization({ name: 'Inviter Org', domain: 'inviter.edu' });
    authUser = await createUser({
      email: 'inviter@inviter.edu',
      organizationId: org.id,
      role: 'USER',
      status: 'ACTIVE',
      isVerified: true,
    });

    const loginRes = await request
      .post('/api/users/login')
      .send({ email: 'inviter@inviter.edu', password: 'Password123!' });
    authToken = loginRes.body.token;

    // Create an unclaimed organization to invite a leader to
    unclaimedOrg = await createOrganization({
      name: 'Unclaimed Uni',
      domain: 'unclaimed.edu',
      isClaimVerified: false,
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('allows an authenticated user to invite a leader', async () => {
    const inviteEmail = 'potential.leader@unclaimed.edu';
    const res = await request
      .post(`/api/public/organizations/${unclaimedOrg.id}/invite-leader`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ email: inviteEmail });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Invitation sent successfully');
    expect(res.body.invitation.email).toBe(inviteEmail);

    const prisma = getPrisma();
    const inv = await prisma.invitation.findFirst({
      where: { email: inviteEmail, organizationId: unclaimedOrg.id }
    });
    expect(inv).toBeDefined();
    expect(inv?.status).toBe('PENDING');
  });

  it('allows claiming an organization with a valid invitation token', async () => {
    const prisma = getPrisma();
    const inviteEmail = 'leader@unclaimed.edu';
    
    // Create an invitation manually using fixture
    const invitation = await createInvitation({
      email: inviteEmail,
      organizationId: unclaimedOrg.id,
      role: 'ADMIN',
    });

    const claimRes = await request
      .post(`/api/users/organizations/${unclaimedOrg.id}/claim`)
      .send({
        email: inviteEmail,
        firstName: 'Leader',
        lastName: 'Person',
        password: 'Password123!',
        invitationToken: invitation.token
      });

    expect(claimRes.status).toBe(201);
    expect(claimRes.body.code).toBe('ORG_CLAIM_SUBMITTED');

    // Verify invitation status updated
    const updatedInv = await prisma.invitation.findUnique({
      where: { id: invitation.id }
    });
    expect(updatedInv?.status).toBe('ACCEPTED');

    // Verify claim has invitation token in metadata
    const claim = await prisma.organizationClaim.findFirst({
      where: { organizationId: unclaimedOrg.id, requesterEmail: inviteEmail }
    });
    expect(claim?.metadata).toMatchObject({
      isInvitedClaim: true,
      invitationToken: invitation.token
    });
  });

  it('rejects claim with a mismatching email', async () => {
    const inviteEmail = 'real.leader@unclaimed.edu';
    const invitation = await createInvitation({
      email: inviteEmail,
      organizationId: unclaimedOrg.id,
    });

    const claimRes = await request
      .post(`/api/users/organizations/${unclaimedOrg.id}/claim`)
      .send({
        email: 'wrong.email@unclaimed.edu',
        firstName: 'Impersonator',
        lastName: 'User',
        password: 'Password123!',
        invitationToken: invitation.token
      });

    expect(claimRes.status).toBe(403);
    expect(claimRes.body.error).toBe('Invitation email does not match claim email');
  });

  it('rejects claim with an invalid token', async () => {
    const claimRes = await request
      .post(`/api/users/organizations/${unclaimedOrg.id}/claim`)
      .send({
        email: 'somebody@unclaimed.edu',
        firstName: 'Some',
        lastName: 'Body',
        password: 'Password123!',
        invitationToken: 'invalid-token'
      });

    expect(claimRes.status).toBe(400);
    expect(claimRes.body.error).toBe('Invalid or expired invitation token');
  });
});
