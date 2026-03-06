import type { Prisma, PrismaClient } from '@prisma/client';

const DEFAULT_CATEGORY_NAMES = ['General', 'Academics', 'Facilities'];

type CategoryTxClient = PrismaClient | Prisma.TransactionClient;

export async function ensureOrganizationDefaultCategories(
  tx: CategoryTxClient,
  organizationId: number
) {
  const existing = await tx.category.findMany({
    where: { organizationId },
    select: { name: true },
  });

  const existingNames = new Set(existing.map((category) => category.name.toLowerCase()));
  const missing = DEFAULT_CATEGORY_NAMES.filter(
    (name) => !existingNames.has(name.toLowerCase())
  );

  if (missing.length === 0) {
    return;
  }

  await tx.category.createMany({
    data: missing.map((name) => ({
      name,
      organizationId,
    })),
  });
}

export { DEFAULT_CATEGORY_NAMES };
