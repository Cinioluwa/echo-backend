import { getPrisma } from '../integration/testContainer.js';
import { Role, Status, ProgressStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const getPrismaClient = () => getPrisma();

export interface CreateOrganizationData {
  name?: string;
  domain?: string;
  status?: string;
}

export interface CreateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  level?: number;
  password?: string;
  role?: Role;
  status?: string;
  organizationId?: number;
}

export interface CreateCategoryData {
  name?: string;
  organizationId?: number;
}

export interface CreatePingData {
  title?: string;
  content?: string;
  hashtag?: string;
  status?: Status;
  progressStatus?: ProgressStatus;
  isAnonymous?: boolean;
  authorId?: number;
  organizationId?: number;
  categoryId?: number;
}

export interface CreateWaveData {
  solution?: string;
  isAnonymous?: boolean;
  pingId?: number;
  organizationId?: number;
}

export interface CreateCommentData {
  content?: string;
  isAnonymous?: boolean;
  pingId?: number;
  waveId?: number;
  authorId?: number;
  organizationId?: number;
}

/**
 * Factory for creating test organizations
 */
export async function createOrganization(data: CreateOrganizationData = {}) {
  const defaultData = {
    name: `Test Org ${Date.now()}`,
    domain: `test${Date.now()}.edu`,
    status: 'ACTIVE',
    ...data,
  };

  return await getPrismaClient().organization.create({
    data: defaultData,
  });
}

/**
 * Factory for creating test users
 */
export async function createUser(data: CreateUserData = {}) {
  const defaultData = {
    email: `user${Date.now()}@example.edu`,
    firstName: 'Test',
    lastName: 'User',
    level: 1,
    password: await bcrypt.hash('Password123!', 10), // Hash the default password
    role: Role.USER,
    status: 'ACTIVE',
    ...data,
  };

  if (!defaultData.organizationId) {
    const org = await createOrganization();
    defaultData.organizationId = org.id;
  }

  return await getPrismaClient().user.create({
    data: defaultData as any, // Type assertion to bypass strict typing
  });
}

/**
 * Factory for creating test categories
 */
export async function createCategory(data: CreateCategoryData = {}) {
  const defaultData = {
    name: `Test Category ${Date.now()}`,
    ...data,
  };

  if (!defaultData.organizationId) {
    const org = await createOrganization();
    defaultData.organizationId = org.id;
  }

  return await getPrismaClient().category.create({
    data: defaultData as any, // Type assertion to bypass strict typing
  });
}

/**
 * Factory for creating test pings
 */
export async function createPing(data: CreatePingData = {}) {
  const defaultData = {
    title: `Test Ping ${Date.now()}`,
    content: 'This is a test ping content',
    hashtag: '#test',
    status: Status.POSTED,
    progressStatus: ProgressStatus.NONE,
    isAnonymous: false,
    ...data,
  };

  if (!defaultData.authorId || !defaultData.organizationId) {
    const user = await createUser();
    defaultData.authorId = user.id;
    defaultData.organizationId = user.organizationId;
  }

  if (!defaultData.categoryId) {
    const category = await createCategory({ organizationId: defaultData.organizationId });
    defaultData.categoryId = category.id;
  }

  return await getPrismaClient().ping.create({
    data: defaultData as any, // Type assertion to bypass strict typing
  });
}

/**
 * Factory for creating test waves
 */
export async function createWave(data: CreateWaveData = {}) {
  const defaultData = {
    solution: `Test Wave Solution ${Date.now()}`,
    isAnonymous: false,
    ...data,
  };

  // Ensure pingId and organizationId are set
  if (!defaultData.pingId || !defaultData.organizationId) {
    const ping = await createPing();
    defaultData.pingId = ping.id;
    defaultData.organizationId = ping.organizationId;
  }

  // Ensure authorId is set
  if (!defaultData.authorId) {
    const user = await createUser({ organizationId: defaultData.organizationId });
    defaultData.authorId = user.id;
  }

  return await getPrismaClient().wave.create({
    data: defaultData as any, // Type assertion to bypass strict typing
  });
}

/**
 * Factory for creating test comments
 */
export async function createComment(data: CreateCommentData = {}) {
  const defaultData = {
    content: `Test comment ${Date.now()}`,
    isAnonymous: false,
    ...data,
  };

  if (!defaultData.authorId) {
    const user = await createUser();
    defaultData.authorId = user.id;
  }

  if (!defaultData.organizationId) {
    if (defaultData.pingId) {
      const ping = await getPrismaClient().ping.findUnique({ where: { id: defaultData.pingId } });
      defaultData.organizationId = ping?.organizationId;
    } else if (defaultData.waveId) {
      const wave = await getPrismaClient().wave.findUnique({ where: { id: defaultData.waveId } });
      defaultData.organizationId = wave?.organizationId;
    } else {
      const user = await getPrismaClient().user.findUnique({ where: { id: defaultData.authorId } });
      defaultData.organizationId = user?.organizationId;
    }
  }

  return await getPrismaClient().comment.create({
    data: defaultData as any, // Type assertion to bypass strict typing
  });
}

export async function cleanupTestData() {
  await getPrismaClient().$transaction([
    getPrismaClient().notification.deleteMany(),
    getPrismaClient().surge.deleteMany(),
    getPrismaClient().comment.deleteMany(),
    getPrismaClient().wave.deleteMany(),
    getPrismaClient().ping.deleteMany(),
    getPrismaClient().announcement.deleteMany(),
    getPrismaClient().category.deleteMany(),
    getPrismaClient().user.deleteMany(),
    getPrismaClient().organization.deleteMany(),
  ]);
}