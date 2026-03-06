import type { JoinPolicy, Prisma, PrismaClient } from '@prisma/client';

export type OrganizationJoinPolicyContext = {
  id: number;
  domain: string | null;
  joinPolicy: JoinPolicy;
  isDomainLocked: boolean;
};

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export const getEffectiveJoinPolicy = (
  organization: OrganizationJoinPolicyContext
): JoinPolicy => {
  if (!organization.domain || organization.isDomainLocked) {
    return 'REQUIRES_APPROVAL';
  }

  return organization.joinPolicy;
};

export const isJoinPolicyLocked = (
  organization: OrganizationJoinPolicyContext
): boolean => !organization.domain || organization.isDomainLocked;

export const shouldAutoJoinOrganization = (
  organization: OrganizationJoinPolicyContext
): boolean => getEffectiveJoinPolicy(organization) === 'OPEN';

export const ensurePendingOrganizationJoinRequest = async (
  prisma: PrismaLike,
  params: {
    organizationId: number;
    userId: number;
    email: string;
  }
) => {
  const existing = await prisma.organizationJoinRequest.findFirst({
    where: {
      organizationId: params.organizationId,
      email: params.email,
      status: 'PENDING',
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.organizationJoinRequest.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      email: params.email,
      status: 'PENDING',
    },
  });
};
