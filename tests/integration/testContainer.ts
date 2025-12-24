import { PrismaClient } from '@prisma/test-client';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

let prisma: PrismaClient;
let dbFile: string;

export async function setupTestDb() {
  // Use unique SQLite file for each test run
  dbFile = join(process.cwd(), 'prisma', `test-${randomUUID()}.db`);
  const dbUrl = `file:${dbFile}`;
  process.env.DATABASE_URL = dbUrl;

  // Check if test Prisma client is already generated
  const testClientPath = join(process.cwd(), 'node_modules', '@prisma', 'test-client', 'index.d.ts');
  if (!existsSync(testClientPath)) {
    // Generate client for test schema only if not already generated
    execSync('npx prisma generate --schema=prisma/test-schema.prisma', { stdio: 'inherit' });
  }

  // Create Prisma client for test schema
  prisma = new PrismaClient({
    datasourceUrl: dbUrl,
  });
  await prisma.$connect();

  // Push schema to SQLite (syncs without migrations)
  execSync('npx prisma db push --schema=prisma/test-schema.prisma --accept-data-loss', { stdio: 'inherit' });

  // Set global test client so the application uses it instead of the main client
  (globalThis as any).__testPrismaClient = prisma;

  return prisma;
}

export async function teardownTestDb() {
  if (prisma) {
    await prisma.$disconnect();
  }
  // Clear the global test client
  (globalThis as any).__testPrismaClient = undefined;
  // Clean up temp file
  if (dbFile && existsSync(dbFile)) {
    try {
      unlinkSync(dbFile);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

export function getPrisma() {
  return prisma;
}
