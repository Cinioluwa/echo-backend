import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const domains = ['stu.cu.edu.ng', 'covenantuniversity.edu.ng'];

async function main() {
  for (const domain of domains) {
    const name = domain;

    await prisma.organization.upsert({
      where: { domain },
      create: {
        name,
        domain,
        status: 'ACTIVE',
      },
      update: {
        status: 'ACTIVE',
      },
    });

    console.log(`Upserted ACTIVE org: ${domain}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
