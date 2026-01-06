import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const parseArgs = (argv) => {
  const out = { days: 30, dryRun: false };

  for (const raw of argv) {
    if (raw === '--dry-run' || raw === '--dryRun') {
      out.dryRun = true;
      continue;
    }

    const m = raw.match(/^--days=(\d+)$/);
    if (m) {
      out.days = Number(m[1]);
      continue;
    }
  }

  if (!Number.isFinite(out.days) || out.days <= 0) out.days = 30;

  return out;
};

const main = async () => {
  const { days, dryRun } = parseArgs(process.argv.slice(2));

  const prisma = new PrismaClient();
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  try {
    const stale = await prisma.organizationRequest.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        domain: true,
        organizationName: true,
        requesterEmail: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!stale.length) {
      console.log(`[cleanup-stale-org-requests] No stale PENDING org requests found (cutoff=${cutoff.toISOString()}).`);
      return;
    }

    console.log(
      `[cleanup-stale-org-requests] Found ${stale.length} stale PENDING org request(s) older than ${days} day(s) (cutoff=${cutoff.toISOString()}).`,
    );

    for (const row of stale) {
      console.log(
        `- #${row.id} ${row.domain} (${row.organizationName}) requester=${row.requesterEmail} createdAt=${row.createdAt.toISOString()}`,
      );
    }

    if (dryRun) {
      console.log('[cleanup-stale-org-requests] Dry run enabled; no changes made.');
      return;
    }

    let updatedCount = 0;

    for (const row of stale) {
      const existingMetadata =
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {};

      await prisma.organizationRequest.update({
        where: { id: row.id },
        data: {
          status: 'REJECTED',
          resolvedAt: now,
          metadata: {
            ...existingMetadata,
            autoRejected: true,
            autoRejectedAt: now.toISOString(),
            autoRejectedReason: `Stale pending request older than ${days} day(s)`,
          },
        },
      });

      updatedCount += 1;
    }

    console.log(`[cleanup-stale-org-requests] Updated ${updatedCount} org request(s) to REJECTED.`);
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((err) => {
  console.error('[cleanup-stale-org-requests] Failed:', err);
  process.exitCode = 1;
});
