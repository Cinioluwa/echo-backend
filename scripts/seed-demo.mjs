import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting Demo Seed (Rich Content)...');

    // 1. Create Organization (Aligned with setup-multitenancy-tests.js)
    const orgDomain = 'cu.edu.ng'; // Changed from covenantuniversity.edu.ng to match test script
    const org = await prisma.organization.upsert({
        where: { domain: orgDomain },
        create: {
            name: 'Covenant University',
            domain: orgDomain,
            status: 'ACTIVE',
        },
        update: { status: 'ACTIVE' },
    });
    console.log(`✅ Upserted Org: ${org.name} (${org.id})`);

    // 2. Create Categories
    const categories = ['Facilities', 'Academics', 'Student Welfare', 'Security'];
    for (const catName of categories) {
        await prisma.category.upsert({
            where: { name_organizationId: { name: catName, organizationId: org.id } },
            create: { name: catName, organizationId: org.id },
            update: {},
        });
    }

    // 3. Create Users
    const passwordHash = await bcrypt.hash('password123', 10);

    // Admin
    const admin = await prisma.user.upsert({
        where: { email_organizationId: { email: `admin@${orgDomain}`, organizationId: org.id } }, // Fixed unique constraint lookup
        create: {
            email: `admin@${orgDomain}`,
            firstName: 'Admin',
            lastName: 'User',
            password: passwordHash,
            role: 'ADMIN',
            organizationId: org.id,
            isVerified: true,
            status: 'ACTIVE',
        },
        update: { role: 'ADMIN', isVerified: true },
    });

    // Student
    const student = await prisma.user.upsert({
        where: { email_organizationId: { email: `student@${orgDomain}`, organizationId: org.id } },
        create: {
            email: `student@${orgDomain}`,
            firstName: 'John',
            lastName: 'Doe',
            password: passwordHash,
            role: 'USER',
            organizationId: org.id,
            isVerified: true,
            status: 'ACTIVE',
            level: 2,
        },
        update: { isVerified: true },
    });

    // 4. Create Rich Content (Pings & Waves)
    const facilityCat = await prisma.category.findFirst({ where: { name: 'Facilities', organizationId: org.id } });
    const academicCat = await prisma.category.findFirst({ where: { name: 'Academics', organizationId: org.id } });

    // Ping 1: Active with high surges
    await prisma.ping.create({
        data: {
            title: 'Broken AC in Lecture Hall',
            content: 'The AC in Hall 2 has been making a loud noise and not cooling for 3 days.',
            authorId: student.id,
            organizationId: org.id,
            categoryId: facilityCat.id,
            status: 'POSTED',
            surgeCount: 12,
            waves: {
                create: [
                    {
                        solution: 'We can open the windows in the meantime.',
                        authorId: student.id,
                        organizationId: org.id,
                        surgeCount: 5
                    }
                ]
            }
        }
    });

    // Ping 2: Resolved with Official Response
    const p2 = await prisma.ping.create({
        data: {
            title: 'Missing Projector Cables',
            content: 'We need HDMI cables in the lab.',
            authorId: student.id,
            organizationId: org.id,
            categoryId: facilityCat.id,
            status: 'APPROVED',
            progressStatus: 'RESOLVED',
            resolvedAt: new Date(),
            surgeCount: 45,
        }
    });

    await prisma.officialResponse.create({
        data: {
            content: 'Cables have been replaced by IT support.',
            authorId: admin.id,
            organizationId: org.id,
            pingId: p2.id,
            isResolved: true,
        }
    });

    // Ping 3: Academic Inquiry
    await prisma.ping.create({
        data: {
            title: 'Clarification on GEN 101 Syllabus',
            content: 'The portal says one thing but the note says another.',
            authorId: student.id,
            organizationId: org.id,
            categoryId: academicCat.id,
            status: 'POSTED',
            progressStatus: 'ACKNOWLEDGED',
            acknowledgedAt: new Date(),
            surgeCount: 3,
        }
    });

    console.log('🎉 Seed Complete! Log in with:');
    console.log(`   Admin: admin@${orgDomain} / password123`);
    console.log(`   User:  student@${orgDomain} / password123`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
