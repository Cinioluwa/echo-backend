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

  // Create test organizations
  const org1 = await prisma.organization.upsert({
    where: { name: 'Test University A' },
    update: {},
    create: {
      name: 'Test University A',
      status: 'ACTIVE',
    },
  });

  const org2 = await prisma.organization.upsert({
    where: { name: 'Test University B' },
    update: {},
    create: {
      name: 'Test University B',
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Created organizations: ${org1.name} (ID: ${org1.id}), ${org2.name} (ID: ${org2.id})`);
  return { org1, org2 };
}

async function createTestUsers(org1, org2) {
  console.log('👥 Creating test users...');

  const hashedPassword = await bcrypt.hash('password123', 10);

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
  console.log(`   Org A: ${userA1.email} (USER), ${adminA.email} (ADMIN)`);
  console.log(`   Org B: ${userB1.email} (USER), ${adminB.email} (ADMIN)`);

  return { userA1, adminA, userB1, adminB };
}

async function createTestCategories(org1, org2) {
  console.log('📂 Creating test categories...');

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
  console.log(`   Org A: ${catA1.name}, ${catA2.name}`);
  console.log(`   Org B: ${catB1.name}`);

  return { catA1, catA2, catB1 };
}

async function main() {
  try {
    console.log('🚀 Starting multitenancy test setup...\n');

    const { org1, org2 } = await createTestOrganizations();
    console.log('');

    const users = await createTestUsers(org1, org2);
    console.log('');

    const categories = await createTestCategories(org1, org2);
    console.log('');

    console.log('🎉 Test setup complete!');
    console.log('\n📋 Test Credentials:');
    console.log('Password for all users: password123');
    console.log('\n🔐 JWT payloads will include:');
    console.log(`   Org A users: organizationId: ${org1.id}`);
    console.log(`   Org B users: organizationId: ${org2.id}`);

    console.log('\n🧪 Ready for testing! Use the testing guide in MULTITENANCY_TESTING.md');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();