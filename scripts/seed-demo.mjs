import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { setDefaultResultOrder } from 'node:dns';

try {
  setDefaultResultOrder('ipv4first');
} catch {}
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Demo Seed (Rich Content)...');

  // Retry connection logic
  let attempts = 0;
  while (attempts < 5) {
    try {
      await prisma.$connect();
      console.log('✅ Connected to DB');
      break;
    } catch (e) {
      attempts++;
      console.error(`❌ Connection Attempt ${attempts} failed: ${e.message}`);
      if (attempts >= 5) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // 1. Create Organization (Aligned with setup-multitenancy-tests.js)
  const orgDomain = 'cu.edu.ng'; // Changed from covenantuniversity.edu.ng to match test script
  const orgName = 'Covenant University';
  const org = await prisma.organization.upsert({
    where: { name: orgName },
    create: {
      name: orgName,
      domain: orgDomain,
      status: 'ACTIVE',
    },
    update: { status: 'ACTIVE' },
  });
  console.log(`✅ Upserted Org: ${org.name} (${org.id})`);

  // 2. Update Categories for cu.edu.ng
  // First, delete pings associated with old categories to avoid foreign key constraints
  const oldCategories = ['Facilities', 'Student Welfare', 'Security', 'Academic', 'Campus Life']; // Include all old categories
  for (const catName of oldCategories) {
    const category = await prisma.category.findFirst({
      where: { name: catName, organizationId: org.id },
    });
    if (category) {
      await prisma.ping.deleteMany({
        where: { categoryId: category.id },
      });
      await prisma.category.delete({
        where: { id: category.id },
      });
    }
  }

  // Then, upsert the new categories
  const newCategories = ['General', 'Academics', 'Chapel', 'Finance', 'Hall', 'Sport', 'Welfare'];
  for (const catName of newCategories) {
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

  // Student 2
  const student2 = await prisma.user.upsert({
    where: { email_organizationId: { email: `student2@${orgDomain}`, organizationId: org.id } },
    create: {
      email: `student2@${orgDomain}`,
      firstName: 'Jane',
      lastName: 'Smith',
      password: passwordHash,
      role: 'USER',
      organizationId: org.id,
      isVerified: true,
      status: 'ACTIVE',
      level: 3,
    },
    update: { isVerified: true },
  });

  // Student 3
  const student3 = await prisma.user.upsert({
    where: { email_organizationId: { email: `student3@${orgDomain}`, organizationId: org.id } },
    create: {
      email: `student3@${orgDomain}`,
      firstName: 'Alex',
      lastName: 'Johnson',
      password: passwordHash,
      role: 'USER',
      organizationId: org.id,
      isVerified: true,
      status: 'ACTIVE',
      level: 1,
    },
    update: { isVerified: true },
  });

  // 4. Create Rich Content (Pings & Waves)
  const hallCat = await prisma.category.findFirst({
    where: { name: 'Hall', organizationId: org.id },
  });
  const academicCat = await prisma.category.findFirst({
    where: { name: 'Academics', organizationId: org.id },
  });
  const welfareCat = await prisma.category.findFirst({
    where: { name: 'Welfare', organizationId: org.id },
  });

  // Ping 1: Active with high surges, multiple waves, and comments
  await prisma.ping.create({
    data: {
      title: 'Broken AC in Lecture Hall',
      content: 'The AC in Hall 2 has been making a loud noise and not cooling for 3 days.',
      authorId: student.id,
      organizationId: org.id,
      categoryId: hallCat.id,
      status: 'POSTED',
      surgeCount: 12,
      waves: {
        create: [
          {
            solution: 'We can open the windows in the meantime.',
            authorId: student2.id,
            organizationId: org.id,
            surgeCount: 5,
            comments: {
              create: [
                {
                  content: 'Good idea, but it gets too noisy from the outside.',
                  authorId: student3.id,
                  organizationId: org.id,
                },
              ],
            },
          },
          {
            solution: 'Has anyone reported this to the physical planning office directly?',
            authorId: student3.id,
            organizationId: org.id,
            surgeCount: 15,
          },
        ],
      },
      comments: {
        create: [
          {
            content: 'It is really unbearable during afternoon classes.',
            authorId: student2.id,
            organizationId: org.id,
            surgeCount: 3,
          },
        ],
      },
    },
  });

  // Ping 2: Resolved with Official Response and the winning wave
  const p2 = await prisma.ping.create({
    data: {
      title: 'Missing Projector Cables',
      content: 'We need HDMI cables in the lab.',
      authorId: student2.id,
      organizationId: org.id,
      categoryId: hallCat.id,
      status: 'APPROVED',
      progressStatus: 'RESOLVED',
      resolvedAt: new Date(),
      surgeCount: 45,
      waves: {
        create: [
          {
            solution: 'I have a spare one I can lend to the class rep for now.',
            authorId: student.id,
            organizationId: org.id,
            surgeCount: 20,
          },
        ],
      },
    },
  });

  await prisma.officialResponse.create({
    data: {
      content: 'Cables have been replaced by IT support. Thank you for the temporary fix.',
      authorId: admin.id,
      organizationId: org.id,
      pingId: p2.id,
      isResolved: true,
    },
  });

  // Ping 3: Academic Inquiry with anonymous comments
  await prisma.ping.create({
    data: {
      title: 'Clarification on GEN 101 Syllabus',
      content: 'The portal says one thing but the note says another.',
      authorId: student3.id,
      organizationId: org.id,
      categoryId: academicCat.id,
      status: 'POSTED',
      progressStatus: 'ACKNOWLEDGED',
      acknowledgedAt: new Date(),
      surgeCount: 3,
      waves: {
        create: [
          {
            solution: 'The lecturer mentioned in class that the portal is outdated.',
            authorId: student.id,
            organizationId: org.id,
            surgeCount: 8,
          },
        ],
      },
      comments: {
        create: [
          {
            content: 'I was so confused about this too!',
            authorId: student2.id,
            organizationId: org.id,
            isAnonymous: true,
            anonymousAlias: 'ConfusedPenguin',
            surgeCount: 2,
          },
        ],
      },
    },
  });

  // Ping 4: Anonymous ping, flagged for review
  await prisma.ping.create({
    data: {
      title: 'Quality of food in the cafeteria',
      content: 'The prices have gone up but the quality has noticeably dropped this week.',
      authorId: student.id,
      organizationId: org.id,
      categoryId: welfareCat.id,
      status: 'POSTED',
      surgeCount: 25,
      isAnonymous: true,
      anonymousAlias: 'HungryHippo99',
      waves: {
        create: [
          {
            solution: 'We should boycott the cafeteria until they fix the prices.',
            authorId: student2.id,
            organizationId: org.id,
            surgeCount: 1,
            flaggedForReview: true,
          },
        ],
      },
    },
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
