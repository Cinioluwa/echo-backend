#!/usr/bin/env node

/**
 * Multitenancy Test Setup Script
 * Creates test organizations and users for testing data isolation
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createTestOrganizations() {
  console.log('🏗️  Setting up test organizations...');

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

  console.log(`✅ Created organizations:`);
  console.log(`   - ${cuOrg.name} (ID: ${cuOrg.id}, Domain: ${cuOrg.domain})`);
  console.log(`   - ${org1.name} (ID: ${org1.id}, Domain: ${org1.domain})`);
  console.log(`   - ${org2.name} (ID: ${org2.id}, Domain: ${org2.domain})`);
  return { cuOrg, org1, org2 };
}

async function createTestUsers(cuOrg, org1, org2) {
  console.log('👥 Creating test users...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // Users for Covenant University
  const cuAdmin = await prisma.user.upsert({
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

  const cuRep = await prisma.user.upsert({
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

  const cuStudent = await prisma.user.upsert({
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
  const userA1 = await prisma.user.upsert({
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

  const adminA = await prisma.user.upsert({
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
  const userB1 = await prisma.user.upsert({
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

  const adminB = await prisma.user.upsert({
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

  console.log('✅ Created test users:');
  console.log(`   CU: ${cuAdmin.email} (ADMIN), ${cuRep.email} (REPRESENTATIVE), ${cuStudent.email} (USER)`);
  console.log(`   Org A: ${userA1.email} (USER), ${adminA.email} (ADMIN)`);
  console.log(`   Org B: ${userB1.email} (USER), ${adminB.email} (ADMIN)`);

  return { cuAdmin, cuRep, cuStudent, userA1, adminA, userB1, adminB };
}

async function createTestCategories(cuOrg, org1, org2) {
  console.log('📂 Creating test categories...');

  // Categories for Covenant University
  const cuCat1 = await prisma.category.upsert({
    where: { name_organizationId: { name: 'Academic', organizationId: cuOrg.id } },
    update: {},
    create: {
      name: 'Academic',
      organizationId: cuOrg.id,
    },
  });

  const cuCat2 = await prisma.category.upsert({
    where: { name_organizationId: { name: 'Campus Life', organizationId: cuOrg.id } },
    update: {},
    create: {
      name: 'Campus Life',
      organizationId: cuOrg.id,
    },
  });

  // Categories for Organization A
  const catA1 = await prisma.category.upsert({
    where: { name_organizationId: { name: 'Academic', organizationId: org1.id } },
    update: {},
    create: {
      name: 'Academic',
      organizationId: org1.id,
    },
  });

  const catA2 = await prisma.category.upsert({
    where: { name_organizationId: { name: 'Campus Life', organizationId: org1.id } },
    update: {},
    create: {
      name: 'Campus Life',
      organizationId: org1.id,
    },
  });

  // Categories for Organization B
  const catB1 = await prisma.category.upsert({
    where: { name_organizationId: { name: 'Academic', organizationId: org2.id } },
    update: {},
    create: {
      name: 'Academic',
      organizationId: org2.id,
    },
  });

  console.log('✅ Created categories:');
  console.log(`   CU: ${cuCat1.name}, ${cuCat2.name}`);
  console.log(`   Org A: ${catA1.name}, ${catA2.name}`);
  console.log(`   Org B: ${catB1.name}`);

  return { cuCat1, cuCat2, catA1, catA2, catB1 };
}

async function main() {
  try {
    console.log('🚀 Starting multitenancy test setup...\n');

    const { cuOrg, org1, org2 } = await createTestOrganizations();
    console.log('');

    const users = await createTestUsers(cuOrg, org1, org2);
    console.log('');

    const categories = await createTestCategories(cuOrg, org1, org2);
    console.log('');

    console.log('🎉 Test setup complete!');
    console.log('\n📋 Test Credentials:');
    console.log('   Password for all: password123');
    console.log('');
    console.log('   Covenant University:');
    console.log('   - Admin: admin@cu.edu.ng');
    console.log('   - Representative: rep@cu.edu.ng');
    console.log('   - Student: student@cu.edu.ng');
    console.log('');
    console.log('   Test University A:');
    console.log('   - Admin: adminA@testuniva.edu');
    console.log('   - Student: studentA@testuniva.edu');
    console.log('');
    console.log('   Test University B:');
    console.log('   - Admin: adminB@testunivb.edu');
    console.log('   - Student: studentB@testunivb.edu');
    console.log('');
    console.log('💡 Use organizationDomain: "cu.edu.ng" for CU registration/login');
    console.log('💡 Use organizationDomain: "testuniva.edu" for Test University A');
    console.log('💡 Use organizationDomain: "testunivb.edu" for Test University B');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();