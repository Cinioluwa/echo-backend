import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_CATEGORY_NAMES = ['General', 'Academics', 'Facilities'];

const NIGERIAN_ACADEMIC_ORGS = [
  { name: 'University of Lagos', domain: 'unilag.edu.ng' },
  { name: 'University of Ibadan', domain: 'ui.edu.ng' },
  { name: 'Ahmadu Bello University', domain: 'abu.edu.ng' },
  { name: 'University of Nigeria', domain: 'unn.edu.ng' },
  { name: 'Obafemi Awolowo University', domain: 'oauife.edu.ng' },
  { name: 'University of Benin', domain: 'uniben.edu' },
  { name: 'Lagos State University', domain: 'lasu.edu.ng' },
  { name: 'University of Ilorin', domain: 'unilorin.edu.ng' },
  { name: 'Federal University of Technology Akure', domain: 'futa.edu.ng' },
  { name: 'Federal University of Technology Owerri', domain: 'futo.edu.ng' },
  { name: 'Bayero University Kano', domain: 'buk.edu.ng' },
  { name: 'Nnamdi Azikiwe University', domain: 'unizik.edu.ng' },
  { name: 'University of Port Harcourt', domain: 'uniport.edu.ng' },
  { name: 'Usmanu Danfodiyo University Sokoto', domain: 'udusok.edu.ng' },
  { name: 'Federal University Oye-Ekiti', domain: 'fuoye.edu.ng' },
  { name: 'University of Jos', domain: 'unijos.edu.ng' },
  { name: 'University of Calabar', domain: 'unical.edu.ng' },
  { name: 'University of Uyo', domain: 'uniuyo.edu.ng' },
  { name: 'Covenant University', domain: 'cu.edu.ng' },
  { name: 'Babcock University', domain: 'babcock.edu.ng' },
  { name: 'Afe Babalola University', domain: 'abuad.edu.ng' },
  { name: 'Redeemers University', domain: 'run.edu.ng' },
  { name: 'Bowen University', domain: 'bowen.edu.ng' },
  { name: 'Nile University of Nigeria', domain: 'nileuniversity.edu.ng' },
  { name: 'Pan-Atlantic University', domain: 'pau.edu.ng' },
];

async function ensureDefaultCategories(organizationId) {
  const existing = await prisma.category.findMany({
    where: { organizationId },
    select: { name: true },
  });

  const existingNames = new Set(existing.map((category) => category.name.toLowerCase()));
  const missing = DEFAULT_CATEGORY_NAMES.filter(
    (name) => !existingNames.has(name.toLowerCase())
  );

  if (missing.length === 0) {
    return 0;
  }

  await prisma.category.createMany({
    data: missing.map((name) => ({ name, organizationId })),
  });

  return missing.length;
}

async function upsertAcademicOrganizations() {
  let createdCount = 0;
  let updatedCount = 0;
  let categoryUpserts = 0;

  for (const entry of NIGERIAN_ACADEMIC_ORGS) {
    const domain = entry.domain.trim().toLowerCase();
    const name = entry.name.trim();

    const existing = await prisma.organization.findUnique({
      where: { domain },
      select: {
        id: true,
        isClaimVerified: true,
      },
    });

    if (!existing) {
      const created = await prisma.organization.create({
        data: {
          name,
          domain,
          status: 'ACTIVE',
          joinPolicy: 'OPEN',
          isDomainLocked: false,
          isClaimVerified: false,
          categoryCustomizationLocked: true,
        },
        select: { id: true },
      });

      createdCount += 1;
      categoryUpserts += await ensureDefaultCategories(created.id);
      continue;
    }

    await prisma.organization.update({
      where: { id: existing.id },
      data: {
        name,
        status: 'ACTIVE',
        ...(existing.isClaimVerified
          ? {}
          : {
              categoryCustomizationLocked: true,
            }),
      },
    });

    updatedCount += 1;
    categoryUpserts += await ensureDefaultCategories(existing.id);
  }

  return { createdCount, updatedCount, categoryUpserts };
}

async function main() {
  const result = await upsertAcademicOrganizations();

  console.log(
    `[seed-nigerian-academic-orgs] complete: created=${result.createdCount}, updated=${result.updatedCount}, categoriesAdded=${result.categoryUpserts}`
  );
}

main()
  .catch((err) => {
    console.error('[seed-nigerian-academic-orgs] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
