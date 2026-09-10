// scripts/expire-demo-orgs.mjs
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function expireDemoOrgs() {
  console.log('Running demo org expiry check...');
  try {
    const now = new Date();

    // Find demo orgs that have expired but are still active
    const expiredOrgs = await prisma.organization.findMany({
      where: {
        isDemo: true,
        status: 'ACTIVE',
        expiresAt: {
          lt: now,
        },
      },
    });

    if (expiredOrgs.length === 0) {
      console.log('No expired demo orgs found.');
      return;
    }

    console.log(`Found ${expiredOrgs.length} expired demo org(s) to suspend.`);

    let suspendedCount = 0;
    for (const org of expiredOrgs) {
      try {
        await prisma.organization.update({
          where: { id: org.id },
          data: { status: 'SUSPENDED' },
        });
        console.log(`Suspended demo org: ${org.name} (${org.id})`);
        suspendedCount++;
      } catch (updateErr) {
        console.error(`Failed to suspend org ${org.id}:`, updateErr);
      }
    }

    console.log(`Successfully suspended ${suspendedCount} demo org(s).`);
  } catch (error) {
    console.error('Error during demo org expiry check:', error);
  } finally {
    await prisma.$disconnect();
  }
}

expireDemoOrgs();
