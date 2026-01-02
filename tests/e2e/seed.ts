import { PrismaClient } from '@prisma/test-client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding E2E database...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // --- Original Seed Data (for ping-lifecycle) ---
    const org = await prisma.organization.upsert({
        where: { name: 'Test Organization 1' },
        update: {},
        create: {
            name: 'Test Organization 1',
            domain: 'testorg1.edu',
            status: 'ACTIVE',
        },
    });

    await prisma.user.upsert({
        where: { email_organizationId: { email: 'admin@testorg1.edu', organizationId: org.id } },
        update: {},
        create: {
            email: 'admin@testorg1.edu',
            password: hashedPassword,
            firstName: 'Admin',
            lastName: 'User',
            role: 'ADMIN',
            status: 'ACTIVE',
            organizationId: org.id,
        },
    });

    await prisma.user.upsert({
        where: { email_organizationId: { email: 'user@testorg1.edu', organizationId: org.id } },
        update: {},
        create: {
            email: 'user@testorg1.edu',
            password: hashedPassword,
            firstName: 'Test',
            lastName: 'User',
            role: 'USER',
            status: 'ACTIVE',
            organizationId: org.id,
        },
    });

    // --- Multitenancy Test Data (from setup-multitenancy-tests.js) ---

    // Create Covenant University organization
    const cuOrg = await prisma.organization.upsert({
        where: { name: 'Covenant University' },
        update: {},
        create: {
            name: 'Covenant University',
            domain: 'cu.edu.ng',
            status: 'ACTIVE',
        },
    });

    // Create test organizations
    const org1 = await prisma.organization.upsert({
        where: { name: 'Test University A' },
        update: {},
        create: {
            name: 'Test University A',
            domain: 'testuniva.edu',
            status: 'ACTIVE',
        },
    });

    const org2 = await prisma.organization.upsert({
        where: { name: 'Test University B' },
        update: {},
        create: {
            name: 'Test University B',
            domain: 'testunivb.edu',
            status: 'ACTIVE',
        },
    });

    // Users for Covenant University
    await prisma.user.upsert({
        where: { email_organizationId: { email: 'admin@cu.edu.ng', organizationId: cuOrg.id } },
        update: {},
        create: {
            email: 'admin@cu.edu.ng',
            password: hashedPassword,
            firstName: 'CU',
            lastName: 'Admin',
            role: 'ADMIN',
            status: 'ACTIVE',
            organizationId: cuOrg.id,
        },
    });

    await prisma.user.upsert({
        where: { email_organizationId: { email: 'rep@cu.edu.ng', organizationId: cuOrg.id } },
        update: {},
        create: {
            email: 'rep@cu.edu.ng',
            password: hashedPassword,
            firstName: 'CU',
            lastName: 'Representative',
            role: 'REPRESENTATIVE',
            status: 'ACTIVE',
            organizationId: cuOrg.id,
        },
    });

    await prisma.user.upsert({
        where: { email_organizationId: { email: 'student@cu.edu.ng', organizationId: cuOrg.id } },
        update: {},
        create: {
            email: 'student@cu.edu.ng',
            password: hashedPassword,
            firstName: 'CU',
            lastName: 'Student',
            role: 'USER',
            status: 'ACTIVE',
            organizationId: cuOrg.id,
        },
    });

    // Users for Organization A
    await prisma.user.upsert({
        where: { email_organizationId: { email: 'studentA@testuniva.edu', organizationId: org1.id } },
        update: {},
        create: {
            email: 'studentA@testuniva.edu',
            password: hashedPassword,
            firstName: 'Alice',
            lastName: 'Student',
            role: 'USER',
            status: 'ACTIVE',
            organizationId: org1.id,
        },
    });

    await prisma.user.upsert({
        where: { email_organizationId: { email: 'adminA@testuniva.edu', organizationId: org1.id } },
        update: {},
        create: {
            email: 'adminA@testuniva.edu',
            password: hashedPassword,
            firstName: 'Admin',
            lastName: 'UnivA',
            role: 'ADMIN',
            status: 'ACTIVE',
            organizationId: org1.id,
        },
    });

    // Users for Organization B
    await prisma.user.upsert({
        where: { email_organizationId: { email: 'studentB@testunivb.edu', organizationId: org2.id } },
        update: {},
        create: {
            email: 'studentB@testunivb.edu',
            password: hashedPassword,
            firstName: 'Bob',
            lastName: 'Student',
            role: 'USER',
            status: 'ACTIVE',
            organizationId: org2.id,
        },
    });

    await prisma.user.upsert({
        where: { email_organizationId: { email: 'adminB@testunivb.edu', organizationId: org2.id } },
        update: {},
        create: {
            email: 'adminB@testunivb.edu',
            password: hashedPassword,
            firstName: 'Admin',
            lastName: 'UnivB',
            role: 'ADMIN',
            status: 'ACTIVE',
            organizationId: org2.id,
        },
    });

    // Categories
    await prisma.category.upsert({
        where: { name_organizationId: { name: 'Academic', organizationId: cuOrg.id } },
        update: {},
        create: { name: 'Academic', organizationId: cuOrg.id },
    });
    await prisma.category.upsert({
        where: { name_organizationId: { name: 'Campus Life', organizationId: cuOrg.id } },
        update: {},
        create: { name: 'Campus Life', organizationId: cuOrg.id },
    });

    await prisma.category.upsert({
        where: { name_organizationId: { name: 'Academic', organizationId: org1.id } },
        update: {},
        create: { name: 'Academic', organizationId: org1.id },
    });
    await prisma.category.upsert({
        where: { name_organizationId: { name: 'Campus Life', organizationId: org1.id } },
        update: {},
        create: { name: 'Campus Life', organizationId: org1.id },
    });

    await prisma.category.upsert({
        where: { name_organizationId: { name: 'Academic', organizationId: org2.id } },
        update: {},
        create: { name: 'Academic', organizationId: org2.id },
    });

    console.log('✅ E2E database seeded with multitenancy data');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
