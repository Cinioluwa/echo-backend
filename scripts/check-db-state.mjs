
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Checking Database State...');

    // Check connection
    try {
        await prisma.$connect();
        console.log('✅ Connected to DB');
    } catch (e) {
        console.error('❌ Failed to connect:', e);
        return;
    }

    const orgDomain = 'cu.edu.ng';
    const org = await prisma.organization.findUnique({ where: { domain: orgDomain } });

    if (!org) {
        console.log(`❌ Organization ${orgDomain} not found.`);
    } else {
        console.log(`✅ Organization found: ${org.name} (${org.id})`);

        const userCount = await prisma.user.count({ where: { organizationId: org.id } });
        console.log(`stats: Users: ${userCount}`);

        const pingCount = await prisma.ping.count({ where: { organizationId: org.id } });
        console.log(`stats: Pings: ${pingCount}`);

        const pings = await prisma.ping.findMany({
            where: { organizationId: org.id },
            select: { id: true, title: true, createdAt: true }
        });
        console.table(pings);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
